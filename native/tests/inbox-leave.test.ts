import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {leaveInboxConversation,inboxFailureMessage} from '../src/profile/leaveRequest.ts';
const thread=(category:'friend'|'office'|'maintenance',schemaVersion?:number)=>({id:'conversation',category,data:{schemaVersion,activeCount:1}});
test('one-tap leave sends only the current conversation and never a team or permanent-delete confirmation',async()=>{
 for(const category of ['friend','office','maintenance'] as const){
  const calls:unknown[]=[];await leaveInboxConversation(thread(category,3),async(op,input)=>{calls.push({op,input});return{left:true};});
  assert.deepEqual(calls,[{op:'leave',input:{conversationId:'conversation'}}]);
 }
});
test('legacy leave delegates to authorized backend cutover, without client membership writes',async()=>{
 for(const [category,source] of [['friend','resident_chats'],['office','office_chats'],['maintenance','maintenance_chats']] as const){
  const calls:unknown[]=[];await leaveInboxConversation(thread(category),async(op,input)=>{calls.push({op,input});return{left:true};});
  assert.deepEqual(calls,[{op:'leaveLegacy',input:{source,legacyId:'conversation'}}]);
 }
});
test('leave resolves only after Firebase acknowledgement; errors and missing acknowledgement reject',async()=>{
 let resolve!:(value:unknown)=>void,finished=false;
 const pending=leaveInboxConversation(thread('office',3),()=>new Promise(done=>{resolve=done;})).then(()=>{finished=true;});
 await Promise.resolve();assert.equal(finished,false);resolve({left:true});await pending;assert.equal(finished,true);
 for(const code of ['functions/not-found','functions/permission-denied','functions/unavailable'])await assert.rejects(leaveInboxConversation(thread('office'),async()=>{throw{code};}));
 await assert.rejects(leaveInboxConversation(thread('office',3),async()=>({})),/confirm/i);
});
test('missing rollout, ownership denial and network failure have distinct useful errors',()=>{
 assert.match(inboxFailureMessage({code:'functions/not-found'},'leave'),/backend update/i);
 assert.match(inboxFailureMessage({code:'permission-denied'},'leave'),/permission/i);
 assert.match(inboxFailureMessage({code:'firestore/permission-denied'},'read'),/rules/i);
 assert.match(inboxFailureMessage({code:'functions/unavailable'},'leave'),/confirm|reconnect/i);
});
test('both Inbox trash controls directly invoke leave; no confirmation state or whole-team wording remains',()=>{
 const ui=readFileSync(new URL('../src/profile/ProfileMenu.tsx',import.meta.url),'utf8');
 assert(!ui.includes('setDeleting'));assert(!ui.includes('{deleting &&'));
 assert(ui.includes('onPress={() => void leaveConversation(t)}'));
 assert(ui.includes('onPress={() => void leaveConversation(conversation)}'));
 const model=readFileSync(new URL('../src/profile/model.ts',import.meta.url),'utf8');assert(!model.includes('for the entire'));
});
