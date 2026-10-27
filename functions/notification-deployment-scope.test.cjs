const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {entry}=require('../security/inbox-push/prepare.cjs');
function exportsFor(stage){const exports={};vm.runInNewContext(entry(stage),{exports,require:name=>name==='firebase-admin/app'?{initializeApp(){}}:new Proxy({},{get:(_,key)=>key})});return Object.keys(exports);}
test('minimum registration artifact exports exactly two non-destructive callables, no event trigger or scheduler',()=>{assert.deepEqual(exportsFor('registration'),['registerInboxDevice','getNotificationState']);});
test('optional held event artifact contains all four categories and excludes callables, schedules and destructive workers',()=>{
 assert.deepEqual(exportsFor('events'),['notifyInboxFriend','notifyInboxOffice','notifyInboxMaintenance','notifyInboxMarketplace','notifyDiscussion','notifyWorkOrderDone']);assert.throws(()=>entry('all'),/Choose/);
});
