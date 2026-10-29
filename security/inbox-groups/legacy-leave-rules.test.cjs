const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {prepareLegacyLeave}=require('./prepare-legacy-leave.cjs');
const {patchLegacyLeaveRules}=require('./legacy-leave-rules.cjs');
// The prior reviewed/deployed Stage A shape is reconstructed locally, not downloaded resident data.
const {prepare}=require('./prepare.cjs');
test('incremental artifact has exact five-function scope, complete dependencies, no indexes or cleanup runner',()=>{
 const full=prepare(path.join(__dirname,'../inbox-push/firestore-replies.candidate.rules'));
 const patched=fs.readFileSync(path.join(full,'firestore.rules'),'utf8');
 assert.throws(()=>patchLegacyLeaveRules(patched),/already present/);
 const temporary=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'townloop-leave-package-test-'));
 const input=path.join(temporary,'baseline.rules');
 const original=`rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
    match /resident_chats/{chatId} {
      allow update: if chatUpdate('friend');
    }
    match /office_chats/{chatId} {
      allow update: if chatUpdate('office');
    }
    match /maintenance_chats/{chatId} {
      allow update: if chatUpdate('maintenance');
    }
    // C1: unaffected Marketplace sentinel
    match /marketplace_chats/{id} { allow write: if false; }
    // Additive Stage A
    function legacyGroupAccess(data) {
      return !('groupConversationId' in data) || (groupAccess(data.groupConversationId) &&
        request.auth.uid + ':' + string(groupMember(data.groupConversationId).epoch) in get(/databases/$(database)/documents/inbox_conversations/$(data.groupConversationId)).data.legacyVisibility);
    }
    match /inbox_conversations/{id} { allow write: if false; }
  }
}`;
 fs.writeFileSync(input,original);const out=prepareLegacyLeave(input,path.join(temporary,'artifact')),scope=JSON.parse(fs.readFileSync(path.join(out,'scope.json')));
 try {
 assert.deepEqual(scope.exports,['manageInboxConversation','getNotificationState','notifyInboxFriend','notifyInboxOffice','notifyInboxMaintenance']);assert.equal(scope.stageBExported,false);assert.deepEqual(scope.requiredIndexes,[]);
 assert(!fs.existsSync(path.join(out,'functions/inbox-group-cleanup-runner.cjs')));
 const current=fs.readFileSync(path.join(out,'firestore.rules'),'utf8');
 assert.equal(current.slice(current.indexOf('// C1:'),current.indexOf('    // Additive Stage A')),original.slice(original.indexOf('// C1:'),original.indexOf('    // Additive Stage A')));
 for(const name of fs.readdirSync(path.join(out,'functions')).filter(n=>n.endsWith('.cjs'))){for(const [,local]of fs.readFileSync(path.join(out,'functions',name),'utf8').matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g))assert(fs.existsSync(path.join(out,'functions',local)),`${name}: ${local}`);}
 } finally { fs.rmSync(temporary,{recursive:true,force:true}); }
});
