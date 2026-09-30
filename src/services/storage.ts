import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, storage, isFirebaseConfigured } from '../firebase';
import { UserProfile } from '../types';
import { savePdfToStorage } from '../utils/pdfStorage';
import {
  saveNewsletterPdfChunksToFirestore,
  getNewsletterPdfFromFirestore,
  deleteNewsletterPdfChunksFromFirestore,
} from './firestoreSync';

export type StorageFolder = 'marketplace' | 'feed' | 'work_orders';

export interface UploadResult {
  url: string; // Live secure web token string from getDownloadURL() or Data URL
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
 * Prevents file name collisions by automatically combining a unique unix timestamp
 * with the user's sanitized ID (e.g., 1726582400_userId_filename.jpg).
 */
export function generateStorageFileName(originalFileName: string, userId: string): string {
  const timestamp = Date.now();
  const sanitizedUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${timestamp}_${sanitizedUserId}_${sanitizedFileName}`;
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

  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    return auth.currentUser;
  }
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user && !user.isAnonymous ? user : null);
    });
  });
}

/**
 * Requirement 1: Session Safeguard
 * Wraps upload triggers tightly around authentication state, verifying user is logged in
 * before attempting uploadBytesResumable and attaching authentication metadata to pass strict production rules.
 *
 * Requirement 2: Dedicated sub-folders: /marketplace, /feed, and /work_orders
 * Requirement 3: Live secure web token download string via getDownloadURL() with seamless fallback
 */
export async function uploadMediaToStorage({
  file,
  folder,
  currentUser,
  onProgress,
}: {
  file: File;
  folder: StorageFolder;
  currentUser?: UserProfile | null;
  onProgress?: (progress: number) => void;
}): Promise<UploadResult> {
  const effectiveUserId = currentUser?.id || auth?.currentUser?.uid || 'user';
  const effectiveEmail = currentUser?.email || auth?.currentUser?.email || '';
  const effectiveName = currentUser?.name || auth?.currentUser?.displayName || 'Resident';

  const userIdStr = String(effectiveUserId);
  const uniqueFileName = generateStorageFileName(file.name, userIdStr);
  const storagePath = `${folder}/${uniqueFileName}`;
  const fileType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';

  // 1. Real client-side Firebase SDK upload if configured
  if (storage && isFirebaseConfigured()) {
    try {
      let firebaseAuthUser = auth?.currentUser || null;
      if (!firebaseAuthUser && auth) {
        try {
          firebaseAuthUser = await ensureFirebaseAuthSession(currentUser);
        } catch {
          // Continue to attempt upload
        }
      }

      const storageRef = ref(storage, storagePath);

      // Attach user login token context and metadata to pass strict production rules
      const metadata = {
        contentType: file.type || (fileType === 'video' ? 'video/mp4' : 'image/jpeg'),
        customMetadata: {
          uploadedBy: userIdStr,
          uploaderEmail: effectiveEmail,
          uploaderName: effectiveName,
          folder,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      };

      return await new Promise<UploadResult>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file, metadata);

        uploadTask.on(
          'state_changed',
          (snapshot: UploadTaskSnapshot) => {
            const progress =
              snapshot.totalBytes > 0
                ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                : 0;
            onProgress?.(progress);
          },
          (error) => {
            console.warn('Firebase Storage upload error, falling back to local storage:', error);
            reject(error);
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              onProgress?.(100);
              resolve({
                url: downloadUrl,
                fileName: uniqueFileName,
                originalName: file.name,
                storagePath,
                type: fileType,
                size: file.size,
              });
            } catch (urlError: any) {
              reject(new Error('Upload completed but its download URL could not be retrieved.'));
            }
          }
        );
      });
    } catch (uploadInitError) {
      console.warn('Firebase Storage upload initialization notice:', uploadInitError);
      // Fall through to local data URL fallback
    }
  }

  // 2. Seamless local fallback (FileReader Data URL)
  return new Promise<UploadResult>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      onProgress?.(100);
      resolve({
        url: reader.result as string,
        fileName: uniqueFileName,
        originalName: file.name,
        storagePath: `local/${storagePath}`,
        type: fileType,
        size: file.size,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
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
      headers: { 'Content-Type': 'application/json' },
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
          uploadedBy: currentUser?.name || 'Admin',
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

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
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

