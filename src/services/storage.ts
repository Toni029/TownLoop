import { authenticatedStoragePath, ownsStorageReference } from './storageReferences';
import { ensureMediaDraft, type MediaRecordLink } from './mediaAuthorization';
import { ref, deleteObject, uploadBytesResumable, getDownloadURL, getBlob } from 'firebase/storage';
import {
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, db, storage, isFirebaseConfigured } from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { savePdfToStorage } from '../utils/pdfStorage';
import {
  saveNewsletterPdfChunksToFirestore,
  getNewsletterPdfFromFirestore,
  deleteNewsletterPdfChunksFromFirestore,
} from './firestoreSync';

export type StorageFolder = 'marketplace' | 'feed' | 'work_orders';

export interface UploadResult {
  url: string; // WorkOrders use a gs:// identity, resolved with authenticated reads.
  fileName: string;
  originalName: string;
  storagePath: string;
  type: 'image' | 'video';
  size: number;
}

export interface UploadProgressTracker {
  progress: number;
  isUploading: boolean;
  error: string | null;
  uploadedUrl: string | null;
  fileName: string | null;
}

/**
 * Requirement 2: File Organization & Unique Names
 * Reduces file name collisions by combining a random suffix and unix timestamp
 * with the user's sanitized ID (e.g., 1726582400_userId_filename.jpg).
 */
export function generateStorageFileName(originalFileName: string, userId: string): string {
  const timestamp = Date.now();
  const sanitizedUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${timestamp}_${sanitizedUserId}_${crypto.randomUUID()}_${sanitizedFileName}`;
}

/**
 * Ensures an active Firebase Auth user session exists before attempting storage operations.
 * If the user is logged into the application UI, this ensures their Firebase Auth ID token
 * is established and active so that storage security rules evaluating request.auth succeed.
 */
export async function ensureFirebaseAuthSession(
  currentUser?: UserProfile | null
): Promise<FirebaseUser | null> {
  if (!auth || !isFirebaseConfigured()) {
    return null;
  }

  await auth.authStateReady();
  return auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser : null;
}

/**
 * Requirement 1: Session Safeguard
 * Wraps upload triggers tightly around authentication state, verifying user is logged in
 * before attempting uploadBytesResumable and attaching authentication metadata to pass strict production rules.
 *
 * Requirement 2: Dedicated sub-folders: /marketplace, /feed, and /work_orders
 * WorkOrder references require authenticated byte delivery; upload failures are surfaced.
 */
export async function uploadMediaToStorage({
  file,
  folder,
  currentUser,
  onProgress,
  recordId, collection,
}: {
  recordId?: string; collection?: MediaRecordLink['collection'];
  file: File;
  folder: StorageFolder;
  currentUser?: UserProfile | null;
  onProgress?: (progress: number) => void;
}): Promise<UploadResult> {
  if (!storage || !db || !isFirebaseConfigured()) throw new Error('Cloud Storage is unavailable.');
  const user = await ensureFirebaseAuthSession(currentUser);
  if (!user || user.isAnonymous) throw new Error('Please sign in before uploading.');
  if (!recordId || !collection) throw new Error('An attachment must be linked to its record.');
  if (file.size <= 0 || file.size >= 25 * 1024 * 1024) throw new Error('Choose a nonempty file smaller than 25MB.');
  const expected = folder === 'work_orders' ? ['work_orders'] : folder === 'feed' ? ['discussion_feed', 'posts'] : ['marketplace_posts', 'marketItems'];
  if (!expected.includes(collection)) throw new Error('Attachment record does not match its folder.');
  await ensureMediaDraft(db, {recordId, collection}, user.uid);
  const fileName = generateStorageFileName(file.name, user.uid);
  const storagePath = `${folder}/${fileName}`;
  const reference = ref(storage, storagePath);
  const task = uploadBytesResumable(reference, file, { contentType: file.type, customMetadata: {
    uploadedBy: user.uid, securityVersion: '1', recordId, collection, originalName: file.name,
  }});
  await new Promise<void>((resolve, reject) => task.on('state_changed', snapshot => {
    onProgress?.(Math.round(snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes) * 100));
  }, reject, resolve));
  if (auth?.currentUser?.uid !== user.uid) throw new Error('Your session changed. Please sign in again.');
  const url = folder === 'work_orders' ? `gs://${reference.bucket}/${storagePath}` : await getDownloadURL(reference);
  return {url, fileName, originalName: file.name, storagePath, type: file.type.startsWith('video/') ? 'video' : 'image', size: file.size};
}

/** Caller must revoke on unmount and sign-out; never persist this temporary authenticated URL. */
export async function resolvePrivateMediaUrl(value: string): Promise<{url: string; revoke: () => void}> {
  if (!storage) throw new Error('Cloud Storage is unavailable.');
  const path = authenticatedStoragePath(value, ref(storage).bucket);
  if (!path) {
    if (value.startsWith('gs://') || ownsStorageReference(value, ref(storage).bucket)) throw new Error('Invalid private attachment.');
    return {url: value, revoke: () => {}};
  }
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) throw new Error('Please sign in to view this attachment.');
  const blob = await getBlob(ref(storage, path), 25 * 1024 * 1024);
  if (auth?.currentUser?.uid !== user.uid) throw new Error('Your session changed.');
  const url = URL.createObjectURL(blob);
  return {url, revoke: () => URL.revokeObjectURL(url)};
}

export interface NewsletterMediaUploadResult {
  pdfUrl: string;
  pageImages?: string[];
}

/**
 * Uploads a raw PDF file straight to Firebase Storage under `/newsletters/{id}/document.pdf`
 * with explicit metadata `{ contentType: 'application/pdf' }` and returns the download URL.
 * If Firebase Storage is not configured or fails, seamlessly caches in IndexedDB and returns data URL.
 */
export async function uploadNewsletterPdfToStorage({
  newsletterId,
  pdfFile,
  currentUser,
  onProgress,
}: {
  newsletterId: string;
  pdfFile: File;
  currentUser?: UserProfile | null;
  onProgress?: (progress: { percent: number; message: string }) => void;
}): Promise<string> {
  if (pdfFile.size <= 0 || pdfFile.size >= 25 * 1024 * 1024) throw new Error('Choose a nonempty PDF smaller than 25MB.');
  if (pdfFile.type !== 'application/pdf') throw new Error('Choose a PDF document.');
  onProgress?.({ percent: 20, message: 'Processing PDF document...' });

  // 1. Read file as Data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read PDF document.'));
    reader.readAsDataURL(pdfFile);
  });

  // 2. Cache in browser IndexedDB immediately (instant offline availability)
  try {
    await savePdfToStorage('current_newsletter_pdf', dataUrl);
    await savePdfToStorage(`newsletter_pdf_${newsletterId}`, dataUrl);
  } catch (idbErr) {
    console.warn('IndexedDB newsletter storage notice:', idbErr);
  }

  // 3. Permanently store PDF in Cloud Firestore chunked storage
  try {
    onProgress?.({ percent: 35, message: 'Saving PDF to permanent Cloud Firestore storage...' });
    await saveNewsletterPdfChunksToFirestore(newsletterId, dataUrl, (pct) => {
      onProgress?.({
        percent: 35 + Math.round(pct * 0.25),
        message: `Saving to Firestore storage (${pct}%)...`,
      });
    });
  } catch (firestoreErr) {
    console.warn('Cloud Firestore chunked PDF storage notice:', firestoreErr);
  }

  // 4. Upload to server filesystem endpoint for lightning-fast streaming and service worker caching
  let finalServerUrl = '';
  try {
    onProgress?.({ percent: 65, message: 'Persisting PDF to server storage...' });
    const serverResp = await fetch('/api/newsletter/upload-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth?.currentUser?.getIdToken() || ''}` },
      body: JSON.stringify({
        fileDataUrl: dataUrl,
        fileName: pdfFile.name || 'document.pdf',
        newsletterId,
      }),
    });

    if (serverResp.ok) {
      const serverResult = await serverResp.json();
      if (serverResult.pdfUrl) {
        finalServerUrl = serverResult.pdfUrl;
      }
    }
  } catch (serverErr) {
    console.warn('Server filesystem upload notice, falling back:', serverErr);
  }

  // 5. Firebase Cloud Storage if configured
  if (isFirebaseConfigured() && storage) {
    try {
      await ensureFirebaseAuthSession(currentUser);
      onProgress?.({ percent: 75, message: 'Syncing PDF to Firebase Cloud Storage...' });

      const storagePath = `newsletters/${newsletterId}/document.pdf`;
      const fileRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(fileRef, pdfFile, {
        contentType: 'application/pdf',
        customMetadata: {
          newsletterId,
          originalName: pdfFile.name || 'document.pdf',
          uploadedBy: auth?.currentUser?.uid || '',
          uploadedAt: new Date().toISOString(),
        },
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 20) + 75;
            onProgress?.({ percent: pct, message: `Uploading to cloud storage (${pct}%)...` });
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadUrl = `gs://${uploadTask.snapshot.ref.bucket}/${storagePath}`;
      onProgress?.({ percent: 100, message: 'PDF stored permanently in cloud!' });
      return downloadUrl;
    } catch (err) {
      console.warn('Firebase Storage upload notice, using persistent Firestore/server URL:', err);
    }
  }

  if (finalServerUrl) {
    onProgress?.({ percent: 100, message: 'Document persisted permanently!' });
    return finalServerUrl;
  }

  // 6. Safe Firestore reference or Data URL
  onProgress?.({ percent: 100, message: 'Document prepared successfully!' });
  return dataUrl;
}

/**
 * Downloads and reassembles the newsletter PDF directly from permanent Cloud Firestore storage
 */
export async function downloadNewsletterPdfFromFirestore(
  newsletterId: string = 'current'
): Promise<string | null> {
  return getNewsletterPdfFromFirestore(newsletterId);
}

/**
 * Cleans up newsletter PDF chunks stored in Cloud Firestore
 */
export async function removeNewsletterPdfFromFirestore(
  newsletterId: string = 'current'
): Promise<void> {
  return deleteNewsletterPdfChunksFromFirestore(newsletterId);
}

/**
 * Uploads an uploaded newsletter PDF directly to Firebase Storage or local cache
 */
export async function uploadNewsletterEditionMedia({
  newsletterId,
  pdfFile,
  pdfDataUrl,
  currentUser,
  onProgress,
}: {
  newsletterId: string;
  pdfFile?: File | null;
  pdfDataUrl?: string;
  pageImages?: any[];
  currentUser?: UserProfile | null;
  onProgress?: (info: { message: string; percent: number }) => void;
}): Promise<NewsletterMediaUploadResult> {
  if (pdfFile) {
    const url = await uploadNewsletterPdfToStorage({
      newsletterId,
      pdfFile,
      currentUser,
      onProgress: (p) => onProgress?.({ message: p.message, percent: p.percent }),
    });
    return { pdfUrl: url };
  }
  return { pdfUrl: pdfDataUrl || '' };
}


/** Remove a superseded edition without deleting the newly published current PDF. */
export async function removeNewsletterEditionFiles(newsletterId: string): Promise<void> {
  if (!newsletterId || newsletterId === 'current') return;
  if (storage) {
    try { await deleteObject(ref(storage, `newsletters/${newsletterId}/document.pdf`)); }
    catch (error: any) { if (error?.code !== 'storage/object-not-found') throw error; }
  }
  await deleteNewsletterPdfChunksFromFirestore(newsletterId);
  if (db) await deleteDoc(doc(db, 'newsletters', newsletterId));
}
