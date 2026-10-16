/** Reject even when a native task or SDK promise never settles. */
export function deadline<T>(promise: Promise<T>, ms: number, label: string, cancel = () => {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} took too long. Check your connection and try again.`));
      try { cancel(); } catch { /* Timeout remains the actionable error. */ }
    }, ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
export function uploadHttpError(status: number): Error {
  if (status === 401) return new Error('Your session expired. Please sign in again and retry the photo.');
  if (status === 403) return new Error('Firebase Storage denied this upload. Your account may not have permission. Please contact the office.');
  if (status === 413) return new Error('This photo is too large. Please choose a smaller file.');
  return new Error(`Photo upload failed (HTTP ${status}). Check your connection and try again.`);
}
