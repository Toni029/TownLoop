const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..'),read=name=>fs.readFileSync(path.join(root,'public',name),'utf8');
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function form(){const source=read('delete-account.html').match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,''),elements=new Map(),calls=[],auth={currentUser:null};let now=1000000,handle=async()=>({data:{status:'requested'}});const element=id=>{if(!elements.has(id))elements.set(id,{value:'',disabled:true,hidden:false,textContent:''});return elements.get(id);};
 const user={uid:'fixture-resident',email:'resident@example.test',getIdToken:async force=>{assert.equal(force,true);return'fixture-token';}};
 vm.runInNewContext(source,{document:{getElementById:element},Date:{now:()=>now},initializeApp:()=>({}),getAuth:()=>auth,inMemoryPersistence:'memory',setPersistence:async()=>{},signOut:async()=>{auth.currentUser=null;},signInWithEmailAndPassword:async()=>{auth.currentUser=user;},signInWithPopup:async()=>{auth.currentUser=user;},GoogleAuthProvider:class{},getFunctions:(_app,region)=>{assert.equal(region,'us-central1');return{};},httpsCallable:(_functions,name)=>async data=>{calls.push({name,data});return handle(name,data);}});
 return{element,calls,auth,advance:ms=>{now+=ms;},handle:next=>{handle=next;},login:async()=>{await settle();await element('passwordLogin').onclick();},submit:()=>element('request').onsubmit({preventDefault(){}})};
}
test('all legal URLs are standalone responsive drafts without the retired app shell or service worker',()=>{
 for(const name of ['privacy.html','terms.html','delete-account.html']){const s=read(name);assert.match(s,/name="viewport"/);assert.match(s,/Prepared for owner approval/);assert.match(s,/href="\/privacy\.html"/);assert.match(s,/href="\/terms\.html"/);assert.match(s,/href="\/delete-account\.html"/);assert.doesNotMatch(s,/id="root"|\/src\/|serviceWorker\.register|sw\.js/);}
 assert.equal((read('delete-account.html').match(/id="confirmation"/g)||[]).length,1);
 assert.match(read('delete-account.html'),/mailto:support@seeds4Clix\.com\?subject=/);
});
test('case-insensitive confirmation submits only a recently verified request, never deletion processing',async()=>{
 for(const text of ['DELETE','delete',' DeLeTe ']){const f=form();await f.login();f.element('confirmation').value=text;f.element('confirmation').oninput();assert.equal(f.element('submit').disabled,false);await f.submit();assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'submitAccountDeletionRequest');assert.equal(f.calls[0].data.requestOnly,true);assert.equal(f.calls[0].data.confirmation,'delete');assert.equal(f.element('request').hidden,true);assert.match(f.element('status').textContent,/does not immediately delete/);assert(f.auth.currentUser);}
});
test('invalid text, expired verification and changed account cannot submit',async()=>{
 const f=form();await f.login();for(const text of ['DEL','delete now','not delete','']){f.element('confirmation').value=text;f.element('confirmation').oninput();assert.equal(f.element('submit').disabled,true);await f.submit();}assert.equal(f.calls.length,0);
 f.element('confirmation').value='delete';f.advance(301000);await f.submit();assert.equal(f.calls.length,0);
 await f.login();f.auth.currentUser={uid:'different-account'};await f.submit();assert.equal(f.calls.length,0);
});
test('duplicate submits are blocked; failed submission preserves the form and permits retry',async()=>{
 const f=form();await f.login();f.element('confirmation').value='delete';let finish;f.handle(()=>new Promise(resolve=>{finish=resolve;}));const first=f.submit();await settle();await f.submit();assert.equal(f.calls.length,1);finish({data:{status:'requested'}});await first;
 const failed=form();await failed.login();failed.element('confirmation').value='delete';failed.handle(async()=>{throw Error('private_backend_detail');});await failed.submit();assert.equal(failed.element('request').hidden,false);assert.equal(failed.element('submit').disabled,false);assert.doesNotMatch(failed.element('status').textContent,/private_backend_detail/);failed.handle(async()=>({data:{status:'approved_held'}}));await failed.submit();assert.match(failed.element('status').textContent,/on hold/);
});
test('retention status never claims permanent completion and status requests do not invoke the worker',async()=>{
 const f=form();await f.login();f.handle(async()=>({data:{status:'retention_pending'}}));await f.element('checkStatus').onclick();assert.equal(f.calls[0].name,'getAccountDeletionStatus');assert.match(f.element('status').textContent,/finalization is still pending/);assert.doesNotMatch(f.element('status').textContent,/completed/);
});
test('legal staging cannot overwrite a site or include the old application bundle',()=>{
 const {stage}=require('./prepare-legal-pages.cjs');assert.throws(()=>stage(path.join(root,'dist')),/ignored \.release/);
 const target=path.join(root,'.release','legal-test-'+process.pid);try{const result=stage(target);assert.deepEqual(fs.readdirSync(target).sort(),['delete-account.html','privacy.html','terms.html']);assert.equal(result.publicationApproved,false);assert.equal(result.hostingConfigChanged,false);}finally{fs.rmSync(target,{recursive:true,force:true});}
});
