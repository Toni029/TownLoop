const test=require('node:test'),assert=require('node:assert/strict');
const {expireAlertClaims}=require('./deletionAlertExpiry.cjs');
test('expiry deletes only proven expired operational claims; preserves unknown fields and future claims',async()=>{
 const now=Date.now(),valid='a'.repeat(64),unknown='b'.repeat(64),future='c'.repeat(64),overlong='d'.repeat(64);
 const data=new Map([[valid,{state:'accepted',createdAt:new Date(now-60*86400000),expiresAt:new Date(now)}],[unknown,{state:'accepted',createdAt:new Date(1),expiresAt:new Date(2),uid:'do-not-touch'}],[future,{state:'sending',createdAt:new Date(now),expiresAt:new Date(now+60*86400000)}],[overlong,{state:'unknown',createdAt:new Date(now-61*86400000),expiresAt:new Date(now)}]]);
 const snap=id=>({id,ref:{id},exists:data.has(id),data:()=>data.get(id)});
 let cursor={};
 const db={doc(path){assert.equal(path,'deletion_policies/admin_alert_expiry_cursor');return {get:async()=>({data:()=>cursor})};},collection(name){assert.equal(name,'deletion_review_deliveries');return {where(key,op,date){assert.equal(key,'expiresAt');assert.equal(op,'<=');assert.equal(+date,now);return this;},orderBy(){return this;},startAfter(){return this;},limit(n){assert.equal(n,50);return this;},async get(){return {docs:[...data.keys()].map(snap),size:data.size};}};},async runTransaction(fn){return fn({get:async ref=>snap(ref.id),delete:ref=>data.delete(ref.id),set:(_ref,value)=>{cursor=value;}});}};
 assert.deepEqual(await expireAlertClaims(db,now),{expired:1,needsReview:2,pageFull:false});assert.deepEqual([...data.keys()],[unknown,future,overlong]);
 assert.equal((await expireAlertClaims(db,now)).expired,0);
});
