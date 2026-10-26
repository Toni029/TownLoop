const test=require('node:test'),assert=require('node:assert/strict');
const {memoryFirestore}=require('./testSupport/memoryFirestore.cjs'),{syncWebMembership,POLICY_PATH}=require('./storageWebAccessPolicy.cjs');
test('deleted hosted profile removes only its authorization projection instead of retaining its UID indefinitely',async()=>{
 const {db,records}=memoryFirestore({[POLICY_PATH]:{legacyUploadsAfter:'preserve',members:{alice:{approved:true,observedAt:{seconds:1,nanoseconds:0}},bob:{approved:true}}}});
 const web={doc:()=>({}),getAll:async()=>[{exists:false,readTime:{seconds:2,nanoseconds:0}}]};
 await syncWebMembership(db,web,'alice');assert.equal(records.get(POLICY_PATH).members.alice,undefined);assert.equal(records.get(POLICY_PATH).members.bob.approved,true);assert.equal(records.get(POLICY_PATH).legacyUploadsAfter,'preserve');
 await syncWebMembership(db,web,'alice');assert.equal(records.get(POLICY_PATH).members.alice,undefined);
});
