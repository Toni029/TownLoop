import {before,test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const project='demo-townloop-abuse',base='http://127.0.0.1:8899',docs=`${base}/v1/projects/${project}/databases/(default)/documents`;
function token(uid){const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),now=Math.floor(Date.now()/1000);return `${encode({alg:'none',typ:'JWT'})}.${encode({sub:uid,user_id:uid,aud:project,iss:`https://securetoken.google.com/${project}`,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'}})}.`;}
function field(v){if(v instanceof Date)return{timestampValue:v.toISOString()};if(Array.isArray(v))return{arrayValue:{values:v.map(field)}};if(v&&typeof v==='object')return{mapValue:{fields:fields(v)}};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return{integerValue:String(v)};return{stringValue:v};}
const fields=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,field(x)]));
async function seed(path,value){const r=await fetch(docs+'/'+path,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(value)})});assert.equal(r.status,200,await r.text());}
const write=(path,value,transforms=[])=>({update:{name:docs.slice(base.length+4)+'/'+path,fields:fields(value)},...(transforms.length?{updateTransforms:transforms.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}:{})});
async function commit(uid,writes){const r=await fetch(docs+':commit',{method:'POST',headers:{Authorization:'Bearer '+token(uid),'Content-Type':'application/json'},body:JSON.stringify({writes})});return{status:r.status,body:await r.text()};}
const success=r=>assert.equal(r.status,200,r.body),denied=r=>assert.equal(r.status,403,r.body);
const post=(uid,extra={})=>({userId:uid,author:uid,authorAvatar:'',unit:'TownLoop Resident',title:'Synthetic',content:'Test',storageDraft:false,comments:[],likes:0,likedBy:{},...extra});
const counter=(scope,target,windowCount=1,dayCount=1,old)=>write('safety_limits/a',{activityScope:scope,activity:{[scope]:{windowAt:old||new Date(),dayAt:old||new Date(),lastAt:new Date(),windowCount,dayCount,bytesDay:0,target}}},old?[`activity.${scope}.lastAt`]:[`activity.${scope}.windowAt`,`activity.${scope}.dayAt`,`activity.${scope}.lastAt`]);
before(async()=>{
 const r=await fetch(base+`/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:fs.readFileSync(new URL('./firestore.rules',import.meta.url),'utf8')}]}})});assert.equal(r.status,200,await r.text());
 const cleared=await fetch(base+`/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',headers:{Authorization:'Bearer owner'}});assert.equal(cleared.status,200);
 for(const [uid,role,approved]of[['a','resident',true],['b','resident',true],['admin','admin',true],['crew','crew',true],['vip','vip',true],['pending','resident',false]])await seed('users/'+uid,{id:uid,name:uid,approved,role});
 await seed('security_controls/abuse_limits',{protocolVersion:1,prepareClients:true,enforceWrites:true,requireMediaReservations:true});
});
test('direct writes, counters for another UID, and forged/reset counters are denied',async()=>{
 denied(await commit('a',[write('discussion_feed/no-quota',post('a'),['createdAt'])]));
 denied(await commit('b',[counter('posts','discussion_feed/wrong'),write('discussion_feed/wrong',post('b'),['createdAt'])]));
 denied(await commit('pending',[write('discussion_feed/pending',post('pending'),['createdAt'])]));
});
test('atomic quota and post commit succeeds; one counter cannot authorize two records',async()=>{
 success(await commit('a',[counter('posts','discussion_feed/first'),write('discussion_feed/first',post('a'),['createdAt'])]));
 const old=new Date();await seed('safety_limits/a',{activityScope:'posts',activity:{posts:{windowAt:old,dayAt:old,lastAt:old,windowCount:1,dayCount:1,bytesDay:0,target:'old'}}});
 denied(await commit('a',[counter('posts','discussion_feed/one',2,2,old),write('discussion_feed/one',post('a'),['createdAt']),write('discussion_feed/two',post('a'),['createdAt'])]));
});
test('comments and listing creation require the correct independent scope',async()=>{
 await seed('safety_limits/a',{activity:{}});
 await seed('discussion_feed/thread',post('b'));
 const value=post('b',{comments:[{id:'c',authorId:'a',author:'a',authorAvatar:'',authorEmail:'',unit:'TownLoop Resident',text:'Reply',timeAgo:'Just now'}]});
 denied(await commit('a',[write('discussion_feed/thread',value,['updatedAt'])]));
 success(await commit('a',[counter('comments','discussion_feed/thread'),write('discussion_feed/thread',value,['updatedAt'])]));
 await seed('safety_limits/a',{activity:{}});
 success(await commit('a',[counter('listings','marketplace_posts/new'),write('marketplace_posts/new',{...post('a'),description:'For sale',price:'$1',sold:false,claimed:false},['createdAt'])]));
});
test('expired windows reset but daily exhaustion cannot be reset early',async()=>{
 const now=new Date();await seed('safety_limits/a',{activity:{posts:{windowAt:now,dayAt:now,lastAt:now,windowCount:10,dayCount:100,bytesDay:0,target:'old'}},activityScope:'posts'});
 denied(await commit('a',[counter('posts','discussion_feed/excess'),write('discussion_feed/excess',post('a'),['createdAt'])]));
 const yesterday=new Date(Date.now()-86401000);await seed('safety_limits/a',{activity:{posts:{windowAt:yesterday,dayAt:yesterday,lastAt:yesterday,windowCount:10,dayCount:100,bytesDay:0,target:'old'}},activityScope:'posts'});
 success(await commit('a',[counter('posts','discussion_feed/recovered'),write('discussion_feed/recovered',post('a'),['createdAt'])]));
});
test('quota updates cannot alter server-issued upload receipts/report state',async()=>{
 denied(await commit('a',[write('safety_limits/a',{activityScope:'posts',uploads:{forged:{status:'issued'}}})]));
});
test('legacy complete PDF remains readable; direct new chunks need upload ticket',async()=>{
 await seed('newsletters/retained',{id:'retained',uploadedBy:'admin',uploadState:'uploaded',sourceBytes:4,totalChunks:1,totalSize:33});
 denied(await commit('admin',[write('newsletters/retained/chunks/0',{index:0,data:'data:application/pdf;base64,AAAAAA==',sha256:'a'.repeat(64),totalChunks:1,totalSize:33},['updatedAt'])]));
 const r=await fetch(docs+'/newsletters/retained',{headers:{Authorization:'Bearer '+token('admin')}});assert.equal(r.status,200);
 success(await commit('admin',[write('newsletters/retained',{id:'retained',uploadedBy:'admin',uploadState:'published',sourceBytes:4,totalChunks:1,totalSize:33})]));
});
test('quota proofs cannot replay prior commits, skip increments, reset early or cross scopes',async()=>{
 await seed('safety_limits/a',{activity:{}});
 success(await commit('a',[counter('posts','discussion_feed/replayed')]));
 denied(await commit('a',[write('discussion_feed/replayed',post('a'),['createdAt'])]));
 const now=new Date();await seed('safety_limits/a',{activityScope:'posts',activity:{posts:{windowAt:now,dayAt:now,lastAt:now,windowCount:5,dayCount:5,bytesDay:0,target:'prior'}}});
 denied(await commit('a',[counter('posts','discussion_feed/skipped',5,5,now),write('discussion_feed/skipped',post('a'),['createdAt'])]));
 denied(await commit('a',[counter('posts','discussion_feed/reset',1,1),write('discussion_feed/reset',post('a'),['createdAt'])]));
 await seed('safety_limits/a',{activity:{}});
 denied(await commit('a',[counter('posts','marketplace_posts/wrong-scope'),write('marketplace_posts/wrong-scope',{...post('a'),description:'For sale',price:'$1',sold:false,claimed:false},['createdAt'])]));
});
test('expired burst resets independently while daily usage remains cumulative',async()=>{
 const dayAt=new Date(),windowAt=new Date(Date.now()-61000);await seed('safety_limits/a',{activityScope:'posts',activity:{posts:{windowAt,dayAt,lastAt:dayAt,windowCount:10,dayCount:70,bytesDay:0,target:'prior'}}});
 const quota=write('safety_limits/a',{activityScope:'posts',activity:{posts:{windowAt:dayAt,dayAt,lastAt:dayAt,windowCount:1,dayCount:71,bytesDay:0,target:'discussion_feed/window-reset'}}},['activity.posts.windowAt','activity.posts.lastAt']);
 success(await commit('a',[quota,write('discussion_feed/window-reset',post('a'),['createdAt'])]));
});
test('client cannot forge server media receipts and publishing preserves their generation',async()=>{
 await seed('safety_limits/a',{activity:{}});
 denied(await commit('a',[counter('posts','discussion_feed/forged'),write('discussion_feed/forged',post('a',{mediaUploadGeneration:'fake',mediaUploadTickets:{fake:{status:'issued'}}}),['createdAt'])]));
 const proof={mediaUploadGeneration:'server-generation',mediaUploadTickets:{server:{status:'issued',path:'feed/owned.jpg'}}};
 await seed('discussion_feed/draft',{userId:'a',storageDraft:true,storageDraftExpiresAt:new Date(Date.now()+3600000),createdAt:new Date(),...proof});
 denied(await commit('a',[counter('posts','discussion_feed/draft'),write('discussion_feed/draft',post('a'),['createdAt'])]));
 success(await commit('a',[counter('posts','discussion_feed/draft'),write('discussion_feed/draft',post('a',proof),['createdAt'])]));
});
test('reserved PDF dimensions and immutable chunks are enforced without changing its bytes',async()=>{
 const key='a'.repeat(64),prefix='data:application/pdf;base64,',total=prefix.length+8;
 const parent={id:'new-pdf',uploadedBy:'admin',uploadState:'uploading',sourceBytes:4,totalChunks:1,totalSize:total,uploadBudgetId:key};
 await seed('safety_limits/admin',{pdfUploads:{[key]:{uid:'admin',newsletterId:'new-pdf',status:'issued',expiresAt:new Date(Date.now()+3600000),bytes:4,totalChunks:1,totalSize:total}}});
 success(await commit('admin',[write('newsletters/new-pdf',parent)]));
 const chunk={index:0,data:prefix+'AAAAAA==',sha256:'a'.repeat(64),totalChunks:1,totalSize:total};
 success(await commit('admin',[write('newsletters/new-pdf/chunks/0',chunk,['updatedAt'])]));
 denied(await commit('admin',[write('newsletters/new-pdf/chunks/0',{...chunk,data:prefix+'BBBBBB=='},['updatedAt'])]));
 success(await commit('admin',[write('newsletters/new-pdf',{...parent,uploadState:'uploaded'})]));
 denied(await commit('admin',[write('newsletters/new-pdf',parent)]));
});
test('normal Work Order creation allocates its number and quota in one atomic commit',async()=>{
 await seed('safety_limits/a',{activity:{}});await seed('counters/work_orders_four_digit',{ready:true,lastNumber:999,orderId:''});
 const order={userId:'a',userName:'a',userEmail:'a@example.invalid',title:'Fixture repair',description:'Fixture',category:'Other',categoryEmoji:'🔧',photos:[],photoUrl:'',unit:'Unit',status:'Queued',statusNote:'Queued',placeInLine:1,aheadCount:0,comments:[],storageDraft:false,ticketNumber:1000,code:'1000',timeAgo:'Just now'};
 success(await commit('a',[counter('workorders','work_orders/new-order'),write('work_orders/new-order',order,['createdAt']),write('work_order_numbers/1000',{orderId:'new-order'}),write('counters/work_orders_four_digit',{ready:true,lastNumber:1000,orderId:'new-order'})]));
});
