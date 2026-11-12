// Proposed retirement worker. Not deployed. No app data, Auth or PDF-cache deletion.
// Exact retired-path hashes avoid retaining old branding in public worker source.
const retiredPathHashes = new Set([
  '8a5edab282632443219e051e4ade2d1d5bbc671c781051bf1437897cbdfea0f1',
  '213456c5dc963e03ec1f27600c46c954c70224985fa62603db2fb2ab1ca06d35',
  '4e6462aac39876926064aeb0d8194a67a23b1be625f15f13c5b03c5b90434f89',
  '47f0e8934fe6baef0ba9c764051a5f064ac72a0d1c53ff10aa2bb4b6663d66a5',
  'e31882028c89aaa6c147e51fc228dc25bc41d8432b751326acf6ff12dc279def',
  '5d771ff74ef78fd7865ad218c40c977e446c579538166d8f153c3e302b7d45fd',
  '98af39d64c60122a3bf2fe36e2c61a33d4f01b7d573ec503d7cfe8cb9e095a61',
  '00e21c4c1fe5269b8f0e8b89e3cb1ffd75d9abf7fcd9a0af6b7d27e5e357e383',
  'ecef9f93c3cc34bebdca42afab4ae6afc9355619763e2e749b46cf63b2173175',
  'e49c1321d7a0e4234fe2991944104684f61f5c9286ad09aaac9878de93cc3d38',
  '7301b4933f9054311f9a65a9b28ebef22f9627186e7ccf3d4cbcea3c1c76b212',
  '0e344f784b4939a729fc9f324b76f8fefadf858d78055f7f04586d1a6eb1a918',
  'd0154f516aed8959de08d1ce1abf7103ad072d4262ada6928a709ee47a344ebe',
  '0addf8471caaa7a7300320c753279cfcbd722ebb0a374d3652df0b14700fddbe',
  '335d436a74d5b4743a82c2d3bc017a7cf5b445726c8efa16004b7a64f17fdc0f',
]);
async function pathHash(pathname) {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pathname));
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (!/^townloop-cache-v\d+$/.test(name)) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        if (url.origin === self.location.origin && retiredPathHashes.has(await pathHash(url.pathname))) {
          await cache.delete(request);
        }
      }
    }
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
// No fetch handler: normal network requests replace the retired app-shell fallback.
