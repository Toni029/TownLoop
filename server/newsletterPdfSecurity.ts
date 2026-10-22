import firebaseConfig from '../firebase-applet-config.json';

export const MAX_NEWSLETTER_PDF_BYTES = 32 * 1024 * 1024;
export const NEWSLETTER_JSON_LIMIT = Math.ceil(MAX_NEWSLETTER_PDF_BYTES / 3) * 4 + 1024 * 1024;
export class NewsletterInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function validatePdf(buffer: Buffer): Buffer {
  if (!buffer.length || buffer.length > MAX_NEWSLETTER_PDF_BYTES)
    throw new NewsletterInputError('Use a nonempty PDF no larger than 32 MB.', 413);
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
    throw new NewsletterInputError('The document must contain a valid PDF header.');
  return buffer;
}

/** Check the encoded length and alphabet before allocating decoded bytes. */
export function decodePdf(value: unknown): Buffer {
  if (typeof value !== 'string') throw new NewsletterInputError('Missing PDF file data.');
  const prefix = 'data:application/pdf;base64,';
  const encoded = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  if (encoded.length > Math.ceil(MAX_NEWSLETTER_PDF_BYTES / 3) * 4)
    throw new NewsletterInputError('Use a PDF no larger than 32 MB.', 413);
  if (!encoded.length || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
    throw new NewsletterInputError('Invalid PDF base64 data.');
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.toString('base64') !== encoded) throw new NewsletterInputError('Invalid PDF base64 data.');
  return validatePdf(buffer);
}

/** A fixed Google origin and exact own-bucket path prevent arbitrary hosts/DNS targets. */
export function newsletterStorageUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new NewsletterInputError('Unsupported PDF URL.'); }
  const bucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket;
  if (url.protocol === 'gs:' && url.hostname === bucket && !url.username && !url.password && !url.port && !url.search && !url.hash) {
    return newsletterStorageUrl(`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(url.pathname.slice(1))}`);
  }
  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || url.port || url.username || url.password || url.hash)
    throw new NewsletterInputError('Only this app’s Firebase newsletter storage is supported.');
  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
  let object = '';
  try {
    if (!match || decodeURIComponent(match[1]) !== bucket) throw new Error();
    object = decodeURIComponent(match[2]);
  } catch { throw new NewsletterInputError('Unsupported Firebase newsletter path.'); }
  if (!/^newsletters\/[A-Za-z0-9_-]{1,100}\/document\.pdf$/.test(object))
    throw new NewsletterInputError('Unsupported Firebase newsletter path.');
  // Discard public download tokens: Firebase rules must authorize the ID token.
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}?alt=media`;
}

export async function fetchNewsletterPdf(raw: string, authorization: string, fetcher: typeof fetch = fetch): Promise<Buffer> {
  const response = await fetcher(newsletterStorageUrl(raw), {
    headers: { Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/pdf')
    throw new NewsletterInputError('Unable to download a PDF from newsletter storage.');
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_NEWSLETTER_PDF_BYTES)) {
    await response.body?.cancel();
    throw new NewsletterInputError('PDF download exceeds 32 MB.', 413);
  }
  if (!response.body) throw new NewsletterInputError('Missing PDF download.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_NEWSLETTER_PDF_BYTES) throw new NewsletterInputError('PDF download exceeds 32 MB.', 413);
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return validatePdf(Buffer.concat(chunks, size));
}
