/** Token-free object identity. Authorization remains enforced by Storage Rules on every download. */
export function authenticatedStoragePath(value: string, bucket: string): string | null {
  let path: string;
  if (value.startsWith(`gs://${bucket}/`)) path = value.slice(bucket.length + 6);
  else {
    try {
      const url = new URL(value), prefix = `/v0/b/${bucket}/o/`;
      if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || !url.pathname.startsWith(prefix)) return null;
      path = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch { return null; }
  }
  const parts = path.split('/');
  if (parts.some(p=>!p || p==='.' || p==='..' || /[\u0000-\u001f\\]/.test(p))) return null;
  if (['work_orders','feed','marketplace'].includes(parts[0]) && parts.length===2) return path;
  if (parts[0]==='newsletters' && parts.length===3 && parts[2]==='document.pdf') return path;
  return null;
}
export const ownsStorageReference = (value: string, bucket: string) =>
  value.startsWith(`gs://${bucket}/`) || value.startsWith(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`);
