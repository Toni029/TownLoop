import { getBytes, ref } from 'firebase/storage';
import { auth, storage } from '../lib/firebase';
import { MAX_PDF_BYTES } from './edition';

/** Resolve only our Storage objects or the configured server newsletter endpoint. */
export async function downloadPdfBytes(source: string): Promise<Uint8Array> {
  const base = process.env.EXPO_PUBLIC_TOWNLOOP_API_URL;
  const url = new URL(source, base || 'https://invalid.invalid');
  let bytes: Uint8Array;
  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
  if (url.protocol === 'gs:' && url.hostname === storage.app.options.storageBucket && !url.username && !url.password && !url.port && !url.search && !url.hash && /^newsletters\/[A-Za-z0-9_-]{1,100}\/document\.pdf$/.test(url.pathname.slice(1))) {
    bytes = new Uint8Array(await getBytes(ref(storage, url.pathname.slice(1)), MAX_PDF_BYTES));
  } else if (url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' && !url.port && !url.username && !url.password && match &&
      decodeURIComponent(match[1]) === storage.app.options.storageBucket && /^newsletters\/[A-Za-z0-9_-]{1,100}\/document\.pdf$/.test(decodeURIComponent(match[2]))) {
    bytes = new Uint8Array(await getBytes(ref(storage, decodeURIComponent(match[2])), MAX_PDF_BYTES));
  } else if (base && url.origin === new URL(base).origin && url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/api/newsletter/pdf/current_newsletter.pdf') {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Please sign in again.');
    const response = await fetch(url.href, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' });
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_PDF_BYTES) throw new Error('Unable to download the newsletter.');
    bytes = new Uint8Array(await response.arrayBuffer());
  } else throw new Error('Unsupported newsletter download location.');
  if (bytes.length > MAX_PDF_BYTES || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-')
    throw new Error('This file is not a supported PDF.');
  return bytes;
}
