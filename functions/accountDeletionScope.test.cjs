const test=require('node:test'),assert=require('node:assert/strict');
const {DATABASES,classifyOwnership,databaseCompletionReady}=require('./accountDeletionScope.cjs');
test('verified canonical UIDs support the same ownership classification in both databases',()=>{
 const known=new Set(['alice','bob']);
 for(const _db of DATABASES){assert.equal(classifyOwnership({userId:'alice',authorId:'alice'},'alice',known),'owned_exact_uid');assert.equal(classifyOwnership({userId:'bob'},'alice',known),'other_owner');assert.equal(classifyOwnership({participantIds:['alice','bob'],sellerId:'alice',buyerId:'bob'},'alice',known),'shared_exact_uids');}
});
test('names, aliases, missing profiles and conflicting metadata remain excluded',()=>{
 const known=new Set(['alice','bob']);
 for(const metadata of [{name:'Alice'},{},{userId:'alice',participantIds:['alice','legacy_email']},{userId:'alice',authorId:'bob'},{participantIds:['alice','bob_email_com']},{sellerId:'alice',buyerId:'bob',participantIds:['alice','alice']}])assert.equal(classifyOwnership(metadata,'alice',known),'needs_review');
});
test('shared Auth completion requires both exact scopes and no unresolved records',()=>{
 const job={uid:'alice',createdAt:1,review:{policyReference:'fixture'},databaseCompletion:DATABASES.map(databaseId=>({databaseId,uid:'alice',policyReference:'fixture',inventoryVersion:require('./accountDeletionInventory.cjs').INVENTORY_VERSION,inventoryComplete:true,recordsComplete:true,writesFrozen:true,unresolvedIdentityCount:0,unresolvedMediaCount:0,completedAt:2}))};
 assert.equal(databaseCompletionReady(job,3),true);
 for(const patch of [{uid:'bob'},{recordsComplete:false},{writesFrozen:false},{unresolvedMediaCount:1},{unresolvedIdentityCount:1},{completedAt:0},{policyReference:'other'}])assert.equal(databaseCompletionReady({...job,databaseCompletion:[job.databaseCompletion[0],{...job.databaseCompletion[1],...patch}]},3),false);
 assert.equal(databaseCompletionReady({...job,databaseCompletion:job.databaseCompletion.slice(0,1)},3),false);
 assert.equal(databaseCompletionReady({...job,databaseCompletion:[job.databaseCompletion[0],job.databaseCompletion[0]]},3),false);
});
test('known deployed anonymous-write website rules cannot be certified by a policy checkbox',()=>{
 const {writeFreezeReady,BLOCKED_NAMED_RULES}=require('./accountDeletionScope.cjs');
 const policy={scopeWriteFreezeVerified:Object.fromEntries(DATABASES.map(id=>[id,true])),scopeRuleHashes:Object.fromEntries(DATABASES.map((id,i)=>[id,String(i+1).repeat(64)])),tokenDrainMs:3900000};
 assert.equal(writeFreezeReady(policy),true);policy.scopeRuleHashes[DATABASES[1]]=BLOCKED_NAMED_RULES;assert.equal(writeFreezeReady(policy),false);
});
test('old coverage receipts cannot authorize Auth deletion after inventory requirements change',()=>{
 const job={uid:'alice',createdAt:1,review:{policyReference:'fixture'},databaseCompletion:DATABASES.map(databaseId=>({databaseId,uid:'alice',policyReference:'fixture',inventoryComplete:true,recordsComplete:true,writesFrozen:true,unresolvedIdentityCount:0,unresolvedMediaCount:0,completedAt:2}))};
 assert.equal(databaseCompletionReady(job,3),false);
});
