const test=require('node:test'),assert=require('node:assert/strict'),{objectHashes,pathFor}=require('./deletionMediaReferences.cjs');
test('attachment inventory deduplicates object identities and never saves tokens or message bodies',()=>{
 const bucket='cc-livingcommunity-app.firebasestorage.app',url=`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/feed%2Ffixture.jpg?alt=media&token=synthetic-token`;
 const hashes=objectHashes({media:[{url},{storagePath:'feed/fixture.jpg'}],comments:[{photoUrl:`gs://${bucket}/work_orders/fixture.png`,text:'private synthetic body'}],messages:[{body:`gs://${bucket}/marketplace/not-an-attachment.jpg`}]});
 assert.equal(hashes.length,2);assert.equal(hashes.every(h=>/^[a-f0-9]{64}$/.test(h)),true);assert.equal(JSON.stringify(hashes).includes('synthetic'),false);
 assert.equal(pathFor(`https://example.test/file.jpg`),null);assert.equal(pathFor(`gs://other-bucket/feed/fixture.jpg`),null);assert.equal(pathFor('feed/../secret'),null);
});
