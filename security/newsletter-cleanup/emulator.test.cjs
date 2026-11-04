const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required; never run against production.');
const fnRequire=require('node:module').createRequire(require.resolve('../../functions/package.json'));
const {initializeApp,deleteApp}=fnRequire('firebase-admin/app'),{getFirestore}=fnRequire('firebase-admin/firestore');
const {AGE_MS,purgeDraft,sweepDrafts}=require('../../functions/newsletterDraftCleanup.cjs');
const project='demo-townloop-news-cleanup',app=initializeApp({projectId:project}),db=getFirestore(app,'(default)');
after(()=>deleteApp(app));
const base=`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents`;
const manifest=(id,extra={})=>({id,uploadState:'uploaded',uploadedBy:'manager',hasFirestoreBlob:true,pdfUrl:`firestore:${id}`,fileUrl:`firestore:${id}`,pageImages:[],sourceBytes:10,totalChunks:1,totalSize:43,...extra});
async function seed(id,extra={}){const ref=db.doc('newsletters/'+id),m=manifest(id,extra);await ref.set(m);await ref.collection('chunks').doc('0').set({index:0,totalChunks:m.totalChunks,totalSize:m.totalSize,data:'fixture-pdf'});return ref;}
async function exists(path){return (await db.doc(path).get()).exists;}
test('newsletter cleanup eligibility, fences, idempotency, crash recovery and authorization',async()=>{
 const reset=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE'});assert.equal(reset.ok,true);
 await db.doc('users/manager').set({approved:true,role:'admin'});await db.doc('users/vip').set({approved:true,role:'vip'});await db.doc('users/resident').set({approved:true,role:'resident'});
 const disabled=await seed('disabled');await assert.rejects(purgeDraft(db,'disabled'),/not activated/);assert.equal(await exists('newsletters/disabled/chunks/0'),true);assert.deepEqual(await sweepDrafts(db),{disabled:true});
 const pub=await seed('published',{uploadState:'published'});await db.doc('newsletters/current').set({id:'published',uploadState:'published'});
 await assert.rejects(purgeDraft(db,'published',{reason:'discarded',actor:'manager',enabled:true}),/Published/);
 const shared=await seed('referenced');await db.doc('newsletters/archive-ref').set({id:'archive-ref',pdfUrl:'firestore:referenced'});
 await assert.rejects(purgeDraft(db,'referenced',{reason:'discarded',actor:'manager',enabled:true}),/referenced/);
 await seed('unauthorized');await assert.rejects(purgeDraft(db,'unauthorized',{reason:'discarded',actor:'resident',enabled:true}),/Admin\/VIP/);
 const fresh=await seed('fresh'),written=Math.max((await fresh.get()).updateTime.toMillis(),(await fresh.collection('chunks').doc('0').get()).updateTime.toMillis());
 assert.equal((await purgeDraft(db,'fresh',{enabled:true,now:written+AGE_MS-1})).purged,false);
 assert.equal(await exists('newsletters/fresh/chunks/0'),true);
 assert.equal((await purgeDraft(db,'fresh',{enabled:true,now:written+AGE_MS+1})).purged,true);
 assert.equal(await exists('newsletters/fresh'),false);assert.equal(await exists('newsletters/fresh/chunks/0'),false);
 assert.equal((await purgeDraft(db,'fresh',{reason:'discarded',actor:'vip',enabled:true})).purged,true);
 await db.doc('newsletter_analysis_jobs/discard-derived').set({newsletterId:'discard',result:{fixture:true}});await db.doc('newsletter_analysis_jobs/keep-derived').set({newsletterId:'published',result:{fixture:true}});await seed('discard');assert.equal((await purgeDraft(db,'discard',{reason:'discarded',actor:'manager',enabled:true})).purged,true);
 assert.equal(await exists('newsletter_analysis_jobs/discard-derived'),false);assert.equal(await exists('newsletter_analysis_jobs/keep-derived'),true);
 const extra=await seed('extra-scope');await extra.collection('evidence').doc('keep').set({hold:true});await assert.rejects(purgeDraft(db,'extra-scope',{reason:'discarded',actor:'manager',enabled:true}),/additional records/);assert.equal(await exists('newsletters/extra-scope/chunks/0'),true);
 await db.doc('newsletters/orphan/chunks/0').set({index:0,totalChunks:1,totalSize:43,data:'fixture'});
 await assert.rejects(purgeDraft(db,'orphan',{reason:'discarded',actor:'manager',enabled:true}),/historical upload/);assert.equal(await exists('newsletters/orphan/chunks/0'),true);
 const active=await seed('active'),before=(await active.get()).updateTime.toMillis();await active.update({activity:true});await active.update({activity:false});const touched=(await active.get()).updateTime.toMillis();assert.ok(touched>before);assert.equal((await purgeDraft(db,'active',{enabled:true,now:before+AGE_MS+1})).purged,false);
 await seed('resume');let txs=0;const interrupted=new Proxy(db,{get(target,key){if(key==='runTransaction')return fn=>{if(++txs===2)throw Error('fixture interruption');return target.runTransaction(fn);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(purgeDraft(interrupted,'resume',{reason:'discarded',actor:'manager',enabled:true}),/interruption/);assert.equal((await db.doc('newsletter_draft_cleanup/resume').get()).data().state,'purging');assert.equal(await exists('newsletters/resume/chunks/0'),true);
 assert.equal((await purgeDraft(db,'resume',{enabled:true})).purged,true);
 const many=await seed('many',{sourceBytes:480*1024*100+10,totalChunks:101,totalSize:27+Math.ceil((480*1024*100+10)/3)*4});const m=(await many.get()).data(),batch=db.batch();for(let i=1;i<101;i++)batch.set(many.collection('chunks').doc(String(i)),{index:i,totalChunks:101,totalSize:m.totalSize,data:'fixture'});await batch.commit();
 let rounds=0;const afterBatch=new Proxy(db,{get(target,key){if(key==='runTransaction')return fn=>{if(++rounds===3)throw Error('fixture batch interruption');return target.runTransaction(fn);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(purgeDraft(afterBatch,'many',{reason:'discarded',actor:'manager',enabled:true}),/batch interruption/);assert.equal((await many.collection('chunks').get()).size,1);assert.equal(await exists('newsletters/many'),true);assert.equal((await purgeDraft(db,'many',{enabled:true})).purged,true);assert.equal((await many.collection('chunks').get()).size,0);
 await seed('concurrent');const results=await Promise.all([purgeDraft(db,'concurrent',{reason:'discarded',actor:'manager',enabled:true}),purgeDraft(db,'concurrent',{reason:'discarded',actor:'vip',enabled:true})]);assert.ok(results.every(r=>r.purged));
 assert.equal(await exists('newsletters/published/chunks/0'),true);
});
function token(uid){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);return enc({alg:'none',typ:'JWT'})+'.'+enc({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'password'}})+'.';}
test('rules prevent old clients republishing/recreating fenced PDFs, never grant residents newsletter writes',async()=>{
 const r=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:fs.readFileSync('firestore.rules','utf8')}]}})});assert.equal(r.ok,true,await r.text());
 async function patch(path,fields,uid='manager'){return fetch(base+'/'+path,{method:'PATCH',headers:{Authorization:'Bearer '+token(uid),'Content-Type':'application/json'},body:JSON.stringify({fields})});}
 assert.equal((await patch('newsletters/fresh',{id:{stringValue:'fresh'}})).status,403);
 assert.equal((await patch('newsletters/fresh/chunks/0',{index:{integerValue:'0'}})).status,403);
 assert.equal((await patch('newsletters/current',{id:{stringValue:'fresh'},uploadState:{stringValue:'published'}})).status,403);
 assert.equal((await patch('newsletter_draft_cleanup/fresh',{state:{stringValue:'purged'}})).status,403);
 assert.equal((await patch('newsletters/valid-new',{id:{stringValue:'valid-new'}})).status,200);
 assert.equal((await patch('newsletters/current',{id:{stringValue:'valid-new'}})).status,200);
 assert.equal((await patch('newsletters/no-resident',{id:{stringValue:'no-resident'}},'resident')).status,403);
});
test('analysis renews activity using manager token and unchanged PDF bytes; fenced analysis cannot resume',async()=>{
 const {build}=require('esbuild');const built=await build({entryPoints:['server/nativeNewsletter.ts'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external'});const m={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,m,m.exports);
 const bytes=Buffer.from('%PDF-1.7\n'),encoded='data:application/pdf;base64,'+bytes.toString('base64');const ref=await seed('analysis-touch',{sourceBytes:bytes.length,totalSize:encoded.length});await ref.collection('chunks').doc('0').update({data:encoded,totalSize:encoded.length});
 const fetcher=async(url,options)=>{const u=new URL(url);assert.equal(u.hostname,'firestore.googleapis.com');if(u.pathname.endsWith(':commit'))await ref.update({heartbeatRace:true});const localOptions=options?.body?{...options,body:options.body.replaceAll('projects/cc-livingcommunity-app/','projects/'+project+'/')}:options;return fetch(base+u.pathname.split('/documents')[1]+u.search,localOptions);};
 assert.equal(await m.exports.retainedNativePdf('analysis-touch','Bearer '+token('manager'),true,fetcher),bytes.toString('base64'));
 assert.ok((await ref.get()).data().draftActivityAt?.toMillis());
 await db.doc('newsletter_draft_cleanup/analysis-touch').set({state:'purging'});await ref.update({uploadState:'purging'});
 await assert.rejects(m.exports.retainedNativePdf('analysis-touch','Bearer '+token('manager'),true,fetcher),/discarded/);
});
test('fresh-rules patch changes only the reviewed newsletter block and refuses drift',()=>{
 const {patch}=require('./firestore-fence.cjs');const current=fs.readFileSync('firestore.rules','utf8');const start=current.indexOf('    // Server-owned fences'),end=current.indexOf('    // A resident can change only their own RSVP');
 const original=current.slice(0,start)+`    match /newsletters/{newsletterId} {
      allow read: if isApproved();
      allow write: if isManager();

      match /chunks/{chunkId} {
        allow read: if isApproved();
        allow write: if isManager();
      }
    }

`+current.slice(end);
 const patched=patch(original);assert.match(patched,/newsletterDraftFenced/);
 const before=original.slice(0,original.indexOf('    match /newsletters/')),after=original.slice(original.indexOf('    // A resident can change only their own RSVP'));
 assert.ok(patched.startsWith(before));assert.ok(patched.endsWith(after));assert.throws(()=>patch(patched),/Stop and review/);
});
