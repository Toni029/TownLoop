const {test}=require('node:test');
const assert=require('node:assert/strict');
const {approved,manager,reportInput,reportKey,reportTarget}=require('./safetyPolicy.cjs');
test('moderation requires approved canonical roles and excludes deletion-pending actors',()=>{
 assert.equal(manager({role:'admin',approved:true}),true);
 for(const p of [{role:'resident',approved:true,isAdmin:true},{role:'admin',approved:false},{role:'staff',approved:true},{role:'vip',approved:true,deletionPending:true}])assert.equal(manager(p),false);
 assert.equal(approved({role:'resident',approved:true}),true);
});
test('reports validate fields and deduplicate by reporter and immutable target, not user text',()=>{
 const base=reportInput({kind:'post',id:'p1',reason:'spam',details:'One report'});
 assert.equal(reportKey('a',base),reportKey('a',{...base,reason:'other',details:'Retry'}));
 assert.notEqual(reportKey('b',base),reportKey('a',base));
 for(const input of [{kind:'post',id:'../p',reason:'spam'},{kind:'comment',id:'p1',reason:'spam',commentId:'x',collection:'users'}, {kind:'user',id:'u',reason:'other',details:'x'.repeat(1001)}])assert.throws(()=>reportInput(input));
});
test('report author is derived from content and never guessed from names or claimed IDs',()=>{
 const target=reportInput({kind:'comment',id:'p',commentId:'c',collection:'discussion_feed',reason:'harassment'});
 assert.equal(reportTarget(target,{comments:[{id:'c',authorId:'b',author:'A'}]},'a'),'b');
 assert.equal(reportTarget(target,{comments:[{id:'c',author:'A'}]},'a'),null);
 assert.throws(()=>reportTarget(target,{comments:[{id:'c',authorId:'a'}]},'a'));
 assert.throws(()=>reportTarget(target,{comments:[{id:'c'},{id:'c'}]},'a'));
});
