import * as FS from 'expo-file-system/legacy';
export const accountMediaPrefix = (uid: string) => `townloop-private-${encodeURIComponent(uid).length}_${encodeURIComponent(uid)}-`;
/** App-owned temporary copies only; never scans gallery files or another account's namespace. */
export async function clearPrivateMediaCache(uid: string) {
  if (!FS.cacheDirectory) return;
  const names = await FS.readDirectoryAsync(FS.cacheDirectory);
  await Promise.all(names.filter(name=>name.startsWith(accountMediaPrefix(uid)) && !name.includes('/'))
    .map(name=>FS.deleteAsync(FS.cacheDirectory+name,{idempotent:true})));
}
