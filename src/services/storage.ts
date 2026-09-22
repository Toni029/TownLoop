import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, storage, isFirebaseConfigured } from '../firebase';
import { UserProfile } from '../types';

export type StorageFolder = 'marketplace' | 'feed' | 'work_orders';

export interface UploadResult {
  url: string; // Live secure web token string from getDownloadURL()
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
 * Requirement 3: Live secure web token download string via getDownloadURL()
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
  // 1. Session Safeguard: Explicitly verify and establish authentication state
  let firebaseAuthUser = auth?.currentUser || null;
  if (!firebaseAuthUser && isFirebaseConfigured() && auth) {
    try {
      firebaseAuthUser = await ensureFirebaseAuthSession(currentUser);
    } catch {
      // Continue to check fallback
    }
  }

  if (!firebaseAuthUser && (!currentUser || !currentUser.id)) {
    throw new Error(
      'Session Safeguard: Authentication required. You must be signed in with an active account before uploading files to Firebase Storage.'
    );
  }

  const effectiveUserId = firebaseAuthUser?.uid || currentUser?.id || 'user';
  const effectiveEmail = firebaseAuthUser?.email || currentUser?.email || '';
  const effectiveName = currentUser?.name || firebaseAuthUser?.displayName || 'Resident';

  const userIdStr = String(effectiveUserId);
  const uniqueFileName = generateStorageFileName(file.name, userIdStr);
  const storagePath = `${folder}/${uniqueFileName}`;
  const fileType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';

  // Real client-side Firebase SDK upload
  if (storage && isFirebaseConfigured()) {
    try {
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
        // uploadBytesResumable automatically transmits the active user's Firebase Auth ID token
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
          async (error) => {
            reject(new Error(`Failed to upload ${file.name}. Please verify your network and signed-in session.`));
          },
          async () => {
            try {
              // Requirement 3: Capture live secure download string with token
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
      throw new Error('Unable to start the media upload. Please try again.');
    }
  }

  throw new Error('Media uploads require configured Firebase Storage.');
}

export interface NewsletterMediaUploadResult {
  pdfUrl: string;
  pageImages?: string[];
}

/**
 * Uploads a raw PDF file straight to Firebase Storage under `/newsletters/{id}/document.pdf`
 * with explicit metadata `{ contentType: 'application/pdf' }` and returns the download URL.
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
      console.warn('Firebase Storage direct PDF upload fallback:', err);
    }
  }

  throw new Error('Newsletter upload requires configured Firebase Storage.');
}

/**
 * Uploads an uploaded newsletter PDF directly to Firebase Storage
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
