import type { FeedStage } from '../monitoring/feedUploadTrace';
import { Platform } from 'react-native';
import * as FS from 'expo-file-system/legacy';
import { getDownloadURL, ref, uploadBytesResumable, type UploadMetadata } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, storage } from '../lib/firebase';
import { deadline, uploadHttpError } from './deadline';

/** Retry link resolution after a completed transfer without uploading the file again. */
export async function uploadedFileURL(path: string, uid: string): Promise<string> {
  const check = () => { if (auth.currentUser?.uid !== uid) throw new Error('Your session changed. Please sign in again.'); };
  check();
  const reference = ref(storage, path);
  const url = path.startsWith('work_orders/') ? `gs://${reference.bucket}/${path}`
    : await deadline(getDownloadURL(reference), 20_000, 'Getting photo link');
  check();
  return url;
}

/** Same Firebase endpoint/metadata and user token as the JS SDK; native streams a file instead of a JS byte array. */
export async function uploadFile(input: {
  uri: string; webFile?: Blob; size: number; path: string; metadata: UploadMetadata;
  trace?: (stage: FeedStage) => void;
  uid: string; progress: (fraction: number) => void; onTransferred?: () => void;
}): Promise<string> {
  const { uid, path, metadata, progress } = input;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Your session changed. Please sign in again.');
  let active = true;
  let cancel = () => {};
  let rejectSession: (error: Error) => void = () => {};
  const sessionChanged = new Promise<never>((_, reject) => { rejectSession = reject; });
  const stopAuth = onAuthStateChanged(auth, current => {
    if (current?.uid !== uid) {
      active = false;
      rejectSession(new Error('Your session changed. Please sign in again.'));
      cancel();
    }
  });
  const checkSession = () => {
    if (!active || auth.currentUser?.uid !== uid) throw new Error('Your session changed. Please sign in again.');
  };
  const report = (fraction: number) => { if (active) progress(Math.min(0.99, Math.max(0, fraction))); };
  try {
    const transfer = async () => {
      const reference = ref(storage, path);
      if (Platform.OS === 'web') {
        const controller = new AbortController();
        cancel = () => controller.abort();
        const file = input.webFile || await deadline(
          fetch(input.uri, { signal: controller.signal }).then(response => response.blob()),
          30_000, 'Reading photo', cancel,
        );
        if (!file) throw new Error("The selected photo could not be read. Please select it again.");
        checkSession();
        const task = uploadBytesResumable(reference, file, metadata);
        cancel = () => { task.cancel(); };
        let unsubscribe = () => {};
        try {
          await deadline(new Promise<void>((resolve, reject) => {
            unsubscribe = task.on('state_changed', snapshot => report(snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)), reject, resolve);
          }), 120_000, 'Photo upload', cancel);
        } finally { unsubscribe(); }
      } else {
        input.trace?.('token_start');
        const token = await deadline(user.getIdToken(), 20_000, 'Signing in for upload');
        input.trace?.('token_done');
        checkSession();
        const controller = new AbortController();
        cancel = () => controller.abort();
        // These headers and the JSON mapping match Firebase Storage's resumable protocol.
        input.trace?.('session_start');
        const start = await deadline(fetch(
          `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(reference.bucket)}/o?name=${encodeURIComponent(path)}`,
          {
            method: 'POST', signal: controller.signal,
            headers: {
              Authorization: `Firebase ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
              'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
              'X-Goog-Upload-Header-Content-Length': String(input.size),
              'X-Goog-Upload-Header-Content-Type': metadata.contentType || 'application/octet-stream',
            },
            body: JSON.stringify({ name: path, contentType: metadata.contentType, metadata: metadata.customMetadata }),
          },
        ), 30_000, 'Starting photo upload', cancel);
        input.trace?.('session_done');
        if (!start.ok) throw uploadHttpError(start.status);
        const sessionUrl = start.headers.get('X-Goog-Upload-URL');
        if (!sessionUrl || new URL(sessionUrl).protocol !== 'https:') throw new Error('Firebase did not return a secure upload session. Please retry.');
        checkSession();
        const task = FS.createUploadTask(sessionUrl, input.uri, {
          httpMethod: 'POST', uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
          sessionType: FS.FileSystemSessionType.FOREGROUND,
          headers: {
            Authorization: `Firebase ${token}`,
            'Content-Type': metadata.contentType || 'application/octet-stream',
            'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0',
          },
        }, event => report(event.totalBytesSent / Math.max(1, event.totalBytesExpectedToSend)));
        cancel = () => { void task.cancelAsync().catch(() => {}); };
        input.trace?.('native_transfer_start');
        const result = await deadline(task.uploadAsync(), 120_000, 'Photo upload', cancel);
        input.trace?.('native_transfer_done');
        if (!result) throw new Error('Photo upload was cancelled. Please retry.');
        if (result.status < 200 || result.status >= 300) throw uploadHttpError(result.status);
      }
      checkSession();
      input.onTransferred?.();
      input.trace?.('url_start');
      const url = await uploadedFileURL(path, uid);
      checkSession();
      input.trace?.('url_done');
      progress(1);
      return url;
    };
    return await Promise.race([transfer(), sessionChanged]);
  } finally {
    active = false;
    stopAuth();
    cancel();
  }
}
