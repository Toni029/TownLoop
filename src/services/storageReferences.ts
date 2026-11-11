/** Recognize our Firebase links even when malformed, so they never fall back to bearer delivery. */
export function ownsStorageReference(value: string, bucket: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'gs:') return url.hostname === bucket;
    if (url.hostname !== 'firebasestorage.googleapis.com') return false;
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)(?:\/|$)/);
    return !!match && decodeURIComponent(match[1]) === bucket;
  } catch { return false; }
}

/** Token-free object identity. Authorization remains enforced by Storage Rules on every download. */
export function authenticatedStoragePath(value: string, bucket: string): string | null {
  let path: string;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.port) return null;
    if (url.protocol === 'gs:' && url.hostname === bucket && !url.search && !url.hash) {
      // Do not normalize traversal through URL.pathname before validation.
      path = value.slice(value.indexOf('/', value.indexOf('://') + 3) + 1);
    } else {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || !match || decodeURIComponent(match[1]) !== bucket) return null;
      path = decodeURIComponent(match[2]);
    }
  } catch { return null; }
  const parts = path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[\u0000-\u001f\\]/.test(p))) return null;
  if (['work_orders', 'feed', 'marketplace'].includes(parts[0]) && parts.length === 2) return path;
  if (parts[0] === 'newsletters' && parts.length === 3 && parts[2] === 'document.pdf') return path;
  return null;
}

/** The only branch allowed to fetch own media is the authenticated reader; rejection is final. */
export async function resolveStorageMedia<T>(value: string, bucket: string, read: (path: string) => Promise<T>, external: (value: string) => T): Promise<T> {
  const path = authenticatedStoragePath(value, bucket);
  if (path) return read(path);
  if (/^gs:/i.test(value) || ownsStorageReference(value, bucket)) throw new Error('Invalid private attachment.');
  return external(value);
}
