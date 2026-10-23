// Local emulators only; unsigned synthetic JWTs never reach Firebase Authentication.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const project='demo-townloop-c2',bucket=project+'.appspot.com',fire='http://127.0.0.1:8896/v1/projects/'+project+'/databases/(default)/documents',store='http://127.0.0.1:9198';
const run=String(Date.now());
const scoped=name=>name.startsWith('newsletters/')?name.replace(/^newsletters\/([^/]+)/,`newsletters/$1_${run}`):name.replace(/\/([^/]+)$/,`/${run}_$1`);
function jwt(uid,provider='custom'){const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),now=Math.floor(Date.now()/1000);return `${b({alg:'none',typ:'JWT'})}.${b({sub:uid,user_id:uid,aud:project,iss:`https://securetoken.google.com/${project}`,iat:now,exp:now+3600,firebase:{sign_in_provider:provider}})}.`;}
function field(v){return typeof v==='boolean'?{booleanValue:v}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,field(x)]))}}:{stringValue:v};}
async function seed(path,data){const r=await fetch(fire+'/'+path,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,field(v)]))})});assert.equal(r.status,200);}
async function upload(name,metadata,uid,{type='image/jpeg',owner=false,provider='custom'}={}){
 name=scoped(name);
 const headers={'Content-Type':'application/json','X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':'4','X-Goog-Upload-Header-Content-Type':type,...(owner?{Authorization:'Bearer owner'}:uid?{Authorization:'Firebase '+jwt(uid,provider)}:{})};
 const r=await fetch(store+'/v0/b/'+bucket+'/o?name='+encodeURIComponent(name),{method:'POST',headers,body:JSON.stringify({name,contentType:type,metadata})});if(!r.ok)return r.status;
 const url=r.headers.get('X-Goog-Upload-URL');assert.equal(new URL(url).host,'127.0.0.1:9198');
 const done=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':type,'X-Goog-Upload-Command':'upload, finalize','X-Goog-Upload-Offset':'0'},body:Buffer.from('test')});return done.status;
}
// Same blank-content draft schema and server timestamp used by ensureMediaDraft.
async function createClientDraft(collection,id,uid){
 const r=await fetch(fire+':commit',{method:'POST',headers:{Authorization:'Bearer '+jwt(uid),'Content-Type':'application/json'},body:JSON.stringify({writes:[{update:{name:`projects/${project}/databases/(default)/documents/${collection}/${id}`,fields:{userId:{stringValue:uid},storageDraft:{booleanValue:true},storageDraftExpiresAt:{timestampValue:new Date(Date.now()+3600000).toISOString()}}},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]})});
 assert.equal(r.status,200,'Approved client can create its empty attachment draft');
}
const get=(name,uid)=>fetch(store+'/v0/b/'+bucket+'/o/'+encodeURIComponent(scoped(name)),{headers:uid?{Authorization:'Firebase '+jwt(uid)}:{}}).then(r=>r.status);
const ok=status=>assert.ok(status>=200&&status<300,'Expected allow; got '+status);
const denied=status=>assert.ok([401,403].includes(status),'Expected deny; got '+status);
test('native and unchanged web uploads share strict ownership without trusting historical uploader metadata',async()=>{
 for(const [uid,role]of [['Alice','resident'],['Bob','resident'],['Crew','crew'],['Admin','admin'],['Vip','vip']])await seed('users/'+uid,{approved:true,role});
 for(const uid of ['Alice','Crew','Admin','Vip'])for(const [folder,collection]of [['work_orders','work_orders'],['feed','discussion_feed'],['marketplace','marketplace_posts']]){
  const id=`draft_${uid}_${folder}_${run}`;
  await createClientDraft(collection,id,uid);
  const metadata={securityVersion:'1',collection,recordId:id,uploadedBy:uid,folder};
  ok(await upload(`${folder}/${uid}_photo_first.jpg`,metadata,uid));
  ok(await get(`${folder}/${uid}_photo_first.jpg`,uid));
  denied(await upload(`${folder}/${uid}_intruder.jpg`,{...metadata,uploadedBy:'Bob'},'Bob'));
 }

 await seed('work_orders/ticket',{userId:'Alice',storageDraft:false,status:'Queued'});
 await seed('storage_web_authorization/policy',{members:{Web:{approved:true,role:'resident'},WebVip:{approved:true,role:'vip'},Alice:{approved:true,role:'admin'}}});
 const link=uid=>({uploadedBy:uid,recordId:'ticket',collection:'work_orders',securityVersion:'1'});
 ok(await upload('work_orders/native.jpg',link('Alice'),'Alice'));
 denied(await upload('work_orders/bob.jpg',link('Bob'),'Bob'));
 ok(await upload('work_orders/proof.jpg',link('Crew'),'Crew'));
 denied(await upload('work_orders/anonymous.jpg',link('Alice')));
 denied(await upload('work_orders/anon-provider.jpg',link('Alice'),'Alice',{provider:'anonymous'}));
 ok(await get('work_orders/native.jpg','Alice'));denied(await get('work_orders/native.jpg','Bob'));ok(await get('work_orders/native.jpg','Crew'));denied(await get('work_orders/native.jpg','Web'));
 denied(await upload('work_orders/native.jpg',link('Alice'),'Alice'));
 ok(await upload('work_orders/historical.jpg',{uploadedBy:'Alice',folder:'work_orders'},null,{owner:true}));
 const legacy={uploadedBy:'Web',folder:'work_orders'};
 denied(await upload('work_orders/not-active.jpg',legacy,'Web'));
 const activation=await fetch(fire+':commit',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({writes:[{transform:{document:`projects/${project}/databases/(default)/documents/storage_web_authorization/policy`,fieldTransforms:[{fieldPath:'legacyUploadsAfter',setToServerValue:'REQUEST_TIME'}]}}]})});assert.equal(activation.status,200);
 ok(await upload('work_orders/web.jpg',legacy,'Web'));ok(await get('work_orders/web.jpg','Web'));denied(await get('work_orders/web.jpg','Bob'));
 denied(await get('work_orders/historical.jpg','Alice'));
 denied(await upload('work_orders/spoof.jpg',{uploadedBy:'Alice',folder:'work_orders'},'Web'));
 ok(await upload('newsletters/edition/document.pdf',{uploadedBy:'Display Name'},'WebVip',{type:'application/pdf'}));
 denied(await upload('newsletters/other/document.pdf',{uploadedBy:'Web'},'Web',{type:'application/pdf'}));
 denied(await upload('other/blocked.jpg',legacy,'Web'));
 await seed('users/Alice',{approved:false,role:'admin'});
 denied(await upload('work_orders/revoked.jpg',{uploadedBy:'Alice',folder:'work_orders'},'Alice'));
});
