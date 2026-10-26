const test=require('node:test');
const assert=require('node:assert/strict');
const {isAdmin,notifyAdmins}=require('./accountDeletionAdminAlerts.cjs');
function fixture(profiles) {
 const records=new Map(),sends=[];let beforeClaim=()=>{};
 const ref=path=>({path,id:path.split('/').at(-1),get:async()=>snapshot(path),update:async patch=>records.set(path,{...records.get(path),...patch})});
 const snapshot=path=>({exists:records.has(path),id:ref(path).id,ref:ref(path),data:()=>records.get(path)});
 for(const [uid,profile]of Object.entries(profiles)){
  records.set(`users/${uid}`,profile);records.set(`notification_devices/${uid}`,{uid,token:`ExpoPushToken[${uid}]`});
 }
 const db={doc:ref,collection(path){let field,value,cursor='',count=Infinity;const q={where(k,_op,v){field=k;value=v;return q;},orderBy(){return q;},startAfter(id){cursor=id;return q;},limit(n){count=n;return q;},async get(){const docs=[...records.keys()].sort().filter(k=>k.startsWith(path+'/')&&k.split('/').length===2&&ref(k).id>cursor&&(!field||records.get(k)[field]===value)).slice(0,count).map(snapshot);return {docs,size:docs.length};}};return q;},async runTransaction(fn){beforeClaim();return fn({get:async r=>snapshot(r.path),create(r,data){assert.equal(records.has(r.path),false);records.set(r.path,data);},set(r,data){records.set(r.path,data);}});}};
 const options={now:Date.parse('2026-10-26T14:00:00Z'),identity:async()=>({disabled:false}),send:async token=>{sends.push(token);return true;}};
 return {db,records,sends,options,beforeClaim(fn){beforeClaim=fn;}};
}
test('only canonical approved Admins are eligible; VIP review rights do not confer alerts',async()=>{
 const h=fixture({admin:{role:'admin',approved:true},vip:{role:'vip',approved:true},crew:{role:'crew',approved:true},resident:{role:'resident',approved:true},pending:{role:'admin',approved:false},deleted:{role:'admin',approved:true,deletionPending:true},alias:{role:'ADMIN',approved:true}});
 await notifyAdmins(h.db,h.options);assert.deepEqual(h.sends,['ExpoPushToken[admin]']);
 assert.equal(isAdmin({role:'vip',approved:true}),false);
 const receipt=h.records.get([...h.records.keys()].find(k=>k.startsWith('deletion_review_deliveries/')));
 assert.deepEqual(Object.keys(receipt).sort(),['createdAt','expiresAt','state']);assert.equal(+receipt.expiresAt-+receipt.createdAt,60*86400000);
});
test('role revocation, device reassignment and disabled Auth identity suppress delivery',async()=>{
 for(const change of ['role','device','auth']) {
  const h=fixture({admin:{role:'admin',approved:true}});
  if(change==='auth')h.options.identity=async()=>({disabled:true});
  else h.beforeClaim(()=>{if(change==='role')h.records.set('users/admin',{role:'vip',approved:true});else h.records.set('notification_devices/admin',{uid:'other',token:'ExpoPushToken[admin]'});});
  await notifyAdmins(h.db,h.options);assert.deepEqual(h.sends,[]);
 }
});
test('repeated scans and ambiguous failures cannot create notification storms',async()=>{
 const h=fixture({admin:{role:'admin',approved:true}});h.options.send=async token=>{h.sends.push(token);throw Error('network ambiguity');};
 await notifyAdmins(h.db,h.options);await notifyAdmins(h.db,h.options);assert.equal(h.sends.length,1);
 assert.equal([...h.records.values()].find(v=>v.state)?.state,'unknown');
 h.options.now+=86400000;await notifyAdmins(h.db,h.options);assert.equal(h.sends.length,2);
});
test('no devices does not claim successful delivery',async()=>{
 const h=fixture({admin:{role:'admin',approved:true}});h.records.delete('notification_devices/admin');
 assert.equal((await notifyAdmins(h.db,h.options)).accepted,0);assert.deepEqual(h.sends,[]);
});
test('actual push transport sends one content-free Admin payload using a safe HTTP fixture',async()=>{
 const h=fixture({admin:{role:'admin',approved:true},vip:{role:'vip',approved:true}}),sent=[],original=global.fetch;
 global.fetch=async(url,options)=>{assert.equal(url,'https://exp.host/--/api/v2/push/send');sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({data:{status:'ok',id:'synthetic-ticket'}})};};
 try{const result=await notifyAdmins(h.db,{now:h.options.now,identity:h.options.identity});assert.equal(result.accepted,1);assert.equal(sent.length,1);assert.equal(sent[0].to,'ExpoPushToken[admin]');assert.deepEqual(sent[0].data,{type:'deletion_review'});assert.equal(sent[0].ttl,3600);assert.equal(sent[0].body.includes('Admin Reports'),true);}finally{global.fetch=original;}
});
