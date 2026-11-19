const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(enabled=true){const calls=[],module={exports:{}},control={};let handler;const local=name=>{
 if(name==='firebase-admin/app')return{getApps:()=>[{}],getApp:()=>({options:{credential:{}}})};
 if(name==='firebase-admin/firestore')return{getFirestore:()=>control};
 if(name==='firebase-admin/auth')return{getAuth:()=>({})};
 if(name==='firebase-admin/storage')return{getStorage:()=>({bucket:()=>({})})};
 if(name==='firebase-functions/v2/firestore')return{onDocumentWritten:(options,fn)=>{handler=fn;return fn;}};
 if(name==='firebase-functions/v2/storage')return{onObjectFinalized:(_options,fn)=>fn};
 if(name==='./deletionRulesRuntime.cjs')return{createRulesVerifier:()=>async()=>{}};
 if(name==='./accountDeletionLifecycle.cjs')return require(name);
 if(name==='./accountDeletionJob.cjs')return{processDeletionJob:async options=>calls.push(['process',options])};
 if(name==='./accountDeletionReceipts.cjs')return{expireReceipts:async(...args)=>calls.push(['expire',...args])};
 throw Error('Unexpected dependency: '+name);
 };vm.runInNewContext(fs.readFileSync(require.resolve('./accountDeletionJobEntry.cjs'),'utf8'),{require:local,module,exports:module.exports,process:{env:{TOWNLOOP_ACCOUNT_DELETION_ENABLED:String(enabled),TOWNLOOP_SCOPED_DELETION_ENABLED:String(enabled)}}});
 return{calls,run:(before,after)=>handler({params:{jobId:'a'.repeat(64)},data:{before:{data:()=>before},after:{data:()=>after}}})};}
const job={workflowVersion:3,requestId:'generation',status:'queued',executionSignal:1};
test('approval and timeout signals dispatch directly without a scheduled invocation',async()=>{for(const source of ['admin_approval','pending_timeout']){const h=fixture();await h.run({...job,status:'requested',executionSignal:0},{...job,authorization:{source}});assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'process');assert.equal(h.calls[0][1].requestId,'generation');assert.equal(h.calls[0][1].enabled,true);}});
test('ordinary progress, unapproved requests and historical jobs never dispatch',async()=>{const h=fixture();for(const status of ['requested','rejected','cancelled','complete','needs_review'])await h.run(undefined,{...job,status});await h.run(job,{...job,status:'processing'});await h.run(undefined,{status:'queued',uid:'historical'});assert.deepEqual(h.calls,[]);});
test('bounded continuation and late-upload execution signals dispatch the same generation',async()=>{const h=fixture();await h.run(job,{...job,executionSignal:2});assert.equal(h.calls[0][1].requestId,'generation');});
test('completed-root expiry routes only to server metadata cleanup, not the destructive processor',async()=>{const h=fixture();await h.run({...job,status:'complete'},undefined);assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'expire');});

test('staging disables processing and metadata expiration even for valid replayed events',async()=>{const h=fixture(false);await h.run({...job,status:'requested',executionSignal:0},job);await h.run({...job,status:'complete'},undefined);assert.deepEqual(h.calls,[]);});
