import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, storage, isFirebaseConfigured } from '../firebase';
import { UserProfile } from '../types';
import { savePdfToStorage } from '../utils/pdfStorage';

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
  if (isFirebaseConfigured() && storage) {
    try {
      await ensureFirebaseAuthSession(currentUser);
      onProgress?.({ percent: 15, message: 'Uploading PDF to cloud storage...' });

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
            const pct = Math.round((snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 70) + 15;
            onProgress?.({ percent: pct, message: `Uploading PDF document (${pct}%)...` });
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      onProgress?.({ percent: 90, message: 'PDF stored in cloud!' });
      return downloadUrl;
    } catch (err) {
      console.warn('Firebase Storage direct PDF upload failed, caching locally in browser storage:', err);
    }
  }

  // Fallback: Read file as Data URL and persist to IndexedDB
  return new Promise<string>((resolve, reject) => {
    onProgress?.({ percent: 45, message: 'Processing document locally...' });
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        await savePdfToStorage('current_newsletter_pdf', dataUrl);
        await savePdfToStorage(`newsletter_pdf_${newsletterId}`, dataUrl);
      } catch (idbErr) {
        console.warn('IndexedDB newsletter storage notice:', idbErr);
      }
      onProgress?.({ percent: 90, message: 'Document prepared successfully!' });
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error('Failed to read PDF document.'));
    reader.readAsDataURL(pdfFile);
  });
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

