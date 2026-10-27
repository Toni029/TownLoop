import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxTarget,serialOperations,collectionFor} from '../src/notifications/protocol.ts';
test('only explicit Inbox targets are routable; no URL, slash traversal or unknown category',()=>{
 const data={type:'inbox',category:'friend',conversationId:'thread',deviceBinding:'a'.repeat(64)};
 assert.equal(inboxTarget(data)?.conversationId,'thread');
 for(const patch of [{category:'admin'},{type:'url'},{conversationId:'../private'},{deviceBinding:'x'},{conversationId:''}])assert.equal(inboxTarget({...data,...patch}),null);
 assert.equal(inboxTarget(undefined),null);assert.equal(collectionFor.marketplace,'marketplace_chats');
});
test('registration, cancellation and account switching serialize; failed operation cannot deadlock the next',async()=>{
 const serial=serialOperations(),stages:string[]=[];let release=()=>{};
 const wait=new Promise<void>(resolve=>{release=resolve;});
 const first=serial(async()=>{stages.push('first');await wait;stages.push('first done');throw Error('network');});
 const handled=first.catch(()=>{});const second=serial(async()=>{stages.push('revoke');});const third=serial(async()=>{stages.push('register other account');});
 await Promise.resolve();assert.deepEqual(stages,['first']);release();await Promise.all([handled,second,third]);
 assert.deepEqual(stages,['first','first done','revoke','register other account']);
});

test('cold-launch tap waits for authentication; wrong account and denied authorization never open a chat',async()=>{
 const {authorizeTarget}=await import('../src/notifications/protocol.ts');
 const target={category:'friend' as const,conversationId:'chat',deviceBinding:'a'.repeat(64)};
 let session={uid:'',ready:false},reads=0;
 const options={session:()=>session,binding:async()=>target.deviceBinding,authorize:async()=>{reads++;return true;}};
 assert.equal(await authorizeTarget(target,options),false);assert.equal(reads,0);
 session={uid:'b',ready:true};assert.equal(await authorizeTarget(target,options),true);
 assert.equal(await authorizeTarget(target,{...options,binding:async()=> 'c'.repeat(64)}),false);
 assert.equal(await authorizeTarget(target,{...options,authorize:async()=>false}),false);
 assert.equal(await authorizeTarget(target,{...options,authorize:async()=>{session={uid:'another',ready:true};return true;}}),false);
});
test('all four notification categories map to fixed collections; comment targets cannot inject navigation routes',()=>{
 for(const category of ['friend','marketplace','discussion','workorders'] as const){
  const target=inboxTarget({type:'inbox',category,conversationId:'record',commentId:'comment',deviceBinding:'a'.repeat(64)});
  assert.equal(target?.category,category);assert.equal(target?.commentId,'comment');
 }
 assert.equal(collectionFor.discussion,'discussion_feed');assert.equal(collectionFor.workorders,'work_orders');
 assert.equal(inboxTarget({type:'inbox',category:'discussion',conversationId:'record',commentId:'../secret',deviceBinding:'a'.repeat(64)})?.commentId,undefined);
});
test('opaque notification IDs are validated separately and cannot smuggle a chat path',()=>{
 const data={type:'notice',category:'marketplace',noticeId:'a'.repeat(64),deviceBinding:'b'.repeat(64),conversationId:'legacy_email_example_com'};
 assert.equal(inboxTarget(data)?.noticeId,'a'.repeat(64));assert.equal(inboxTarget(data)?.conversationId,'a'.repeat(64));
 assert.equal(inboxTarget({...data,noticeId:'../other'}),null);
});
