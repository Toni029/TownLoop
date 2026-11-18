import {test,before} from 'node:test';import assert from 'node:assert/strict';
const project='demo-townloop-abuse',bucket=project+'.appspot.com',fire=`http://127.0.0.1:8899/v1/projects/${project}/databases/(default)/documents`,store=`http://127.0.0.1:9199/v0/b/${bucket}/o`;
const jwt=uid=>{const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);return `${b({alg:'none',typ:'JWT'})}.${b({sub:uid,user_id:uid,aud:project,iss:`https://securetoken.google.com/${project}`,iat:now,exp:now+3600,firebase:{sign_in_provider:'custom'}})}.`;};
function field(v){if(v instanceof Date)return{timestampValue:v.toISOString()};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return{integerValue:String(v)};if(v&&typeof v==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,field(x)]))}};return{stringValue:v};}
async function seed(path,data){const r=await fetch(fire+'/'+path,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(data).map(([k,x])=>[k,field(x)]))})});assert.equal(r.status,200,await r.text());}
const metadata={uploadedBy:'owner',recordId:'ticket',collection:'work_orders',securityVersion:'1'},key='a'.repeat(64),path='work_orders/security-check.jpg';
const ticket=(patch={})=>({path,bytes:4,contentType:'image/jpeg',metadata,status:'issued',issuedAt:new Date(Date.now()-10000),expiresAt:new Date(Date.now()+3600000),parentGeneration:'generation',...patch});
async function parent(patch={}){await seed('work_orders/ticket',{userId:'owner',storageDraft:false,status:'Queued',mediaUploadGeneration:'generation',mediaUploadTickets:{[key]:ticket()},...patch});}
async function upload(name,meta,uid='owner',admin=false,type='image/jpeg'){
 const headers={'Content-Type':'application/json','X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':'4','X-Goog-Upload-Header-Content-Type':type,Authorization:admin?'Bearer owner':'Firebase '+jwt(uid)};
 const r=await fetch(store+'?name='+encodeURIComponent(name),{method:'POST',headers,body:JSON.stringify({name,contentType:type,metadata:meta})});if(!r.ok)return r.status;
 const url=r.headers.get('X-Goog-Upload-URL');assert.equal(new URL(url).host,'127.0.0.1:9199');
 return (await fetch(url,{method:'POST',headers:{...headers,'Content-Type':type,'X-Goog-Upload-Command':'upload, finalize','X-Goog-Upload-Offset':'0'},body:Buffer.from('test')})).status;
}
const object=(name,uid='owner',method='GET')=>fetch(store+'/'+encodeURIComponent(name)+'?alt=media',{method,headers:{Authorization:'Firebase '+jwt(uid)}}).then(r=>r.status);
const ok=s=>assert.ok(s>=200&&s<300,'Expected allow, got '+s),deny=s=>assert.ok([401,403].includes(s),'Expected deny, got '+s);
before(async()=>{for(const [uid,role]of[['owner','resident'],['outsider','resident'],['crew','crew'],['admin','admin']])await seed('users/'+uid,{approved:true,role});await parent();});
test('strict upload needs server ticket; valid ticket works within Storage two-document lookup limit',async()=>{
 deny(await upload(path,metadata));ok(await upload(path,{...metadata,quotaReservation:key}));
});
test('issued receipt cannot be used to delete/recreate before finalizer; complete cannot upload again',async()=>{
 deny(await object(path,'owner','DELETE'));await parent({mediaUploadTickets:{[key]:ticket({status:'complete'})}});ok(await object(path,'owner','DELETE'));deny(await upload(path,{...metadata,quotaReservation:key}));
});
test('revocation, changed roles and wrong object paths cannot use reserved access',async()=>{
 await parent();deny(await upload(path,{...metadata,quotaReservation:key},'outsider'));deny(await upload('work_orders/wrong.jpg',{...metadata,quotaReservation:key}));
 await seed('users/owner',{approved:false,role:'resident'});deny(await upload(path,{...metadata,quotaReservation:key}));await seed('users/owner',{approved:true,role:'resident'});
});
test('historical private images and newsletter files remain readable only under current authorization',async()=>{
 const old='work_orders/historical.jpg';ok(await upload(old,metadata,'owner',true));ok(await object(old));deny(await object(old,'outsider'));ok(await object(old,'crew'));
 await seed('users/owner',{approved:true,role:'resident',deletionPending:true});deny(await object(old));await seed('users/owner',{approved:true,role:'resident'});
 const pdf='newsletters/historical/document.pdf';ok(await upload(pdf,{},'admin',true,'application/pdf'));ok(await object(pdf));
 deny(await upload('newsletters/new/document.pdf',{},'admin',false,'application/pdf'));
});
test('finalized parent proof can be removed without permitting receipt replay',async()=>{
 await parent();ok(await upload(path,{...metadata,quotaReservation:key}));await parent({mediaUploadTickets:{}});ok(await object(path,'owner','DELETE'));deny(await upload(path,{...metadata,quotaReservation:key}));
});
