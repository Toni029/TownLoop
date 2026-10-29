import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedLegacyLeave,onConfirmedLegacyLeave} from '../src/profile/legacyLeaveEvents.ts';
import {readThread} from '../src/profile/model.ts';
test('legacy removal signal requires positive acknowledgement, is account-scoped and unsubscribes',()=>{
 const calls:string[]=[];const stop=onConfirmedLegacyLeave('a',(source,id)=>calls.push(`${source}/${id}`));const stopOther=onConfirmedLegacyLeave('b',()=>calls.push('WRONG ACCOUNT'));
 for(const response of [{},{left:false}])confirmedLegacyLeave('a','leaveLegacy',{source:'office_chats',legacyId:'x'},response);
 confirmedLegacyLeave('a','send',{source:'office_chats',legacyId:'x'},{left:true});assert.deepEqual(calls,[]);
 confirmedLegacyLeave('a','leaveLegacy',{source:'office_chats',legacyId:'x'},{left:true});assert.deepEqual(calls,['office_chats/x']);stop();stopOther();
 confirmedLegacyLeave('a','leaveLegacy',{source:'office_chats',legacyId:'x'},{left:true});assert.equal(calls.length,1);
});
test('legacy staff departure removes only that user; resident departure makes staff view read-only',()=>{
 const data={residentId:'resident',messages:[],leftBy:{admin:true}};
 assert.equal(readThread('office','x',data,{id:'admin',role:'admin',approved:true} as any),null);
 assert(readThread('office','x',data,{id:'vip',role:'vip',approved:true} as any));
 assert.equal(readThread('office','x',{...data,leftBy:{resident:true}},{id:'vip',role:'vip',approved:true} as any)?.otherLeft,true);
});
