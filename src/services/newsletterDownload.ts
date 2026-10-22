import { getBlob, ref } from 'firebase/storage';
import { auth, storage } from '../firebase';

/** ID tokens go only to same-origin newsletter routes; cloud reads use Storage rules. */
export async function fetchNewsletterResource(source: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(source, window.location.origin);
  if (url.protocol === 'blob:' && url.origin === window.location.origin) return fetch(source, init);
  if (url.origin === window.location.origin && /^\/api\/newsletter\/(current|pdf\/current_newsletter\.pdf)$/.test(url.pathname)) {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error('Please sign in to open the newsletter.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url.href, { ...init, headers, redirect: 'error', cache: 'no-store' });
  }
  if (url.protocol === 'gs:' && storage && url.hostname === storage.app.options.storageBucket && !url.username && !url.password && !url.port && !url.search && !url.hash && /^newsletters\/[A-Za-z0-9_-]{1,100}\/document\.pdf$/.test(url.pathname.slice(1))) {
    const blob = await getBlob(ref(storage, url.pathname.slice(1)), 32 * 1024 * 1024);
    return new Response(blob, { headers: { 'Content-Type': 'application/pdf' } });
  }
  if (url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' && !url.username && !url.password && !url.port && storage) {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
    if (match && decodeURIComponent(match[1]) === storage.app.options.storageBucket && /^newsletters\/[A-Za-z0-9_-]{1,100}\/document\.pdf$/.test(decodeURIComponent(match[2]))) {
      const blob = await getBlob(ref(storage, decodeURIComponent(match[2])), 32 * 1024 * 1024);
      return new Response(blob, { headers: { 'Content-Type': 'application/pdf' } });
    }
  }
  throw new Error('Unsupported newsletter download location.');
}
