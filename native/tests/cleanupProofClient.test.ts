import test from 'node:test';import assert from 'node:assert/strict';
import {createCleanupProofClient,type CleanupCredential} from '../src/localData/cleanupProofClient.ts';
const proof=(uid:string):CleanupCredential=>({uid,deviceId:'a'.repeat(32),secret:'b'.repeat(64),expiresAt:Date.now()+60*86400000});
function storage(initial:CleanupCredential[]){const map=new Map([['townloop_cleanup_proofs_v1',JSON.stringify(initial)]]);return {map,getItem:async(k:string)=>map.get(k)||null,setItem:async(k:string,v:string)=>{map.set(k,v);},removeItem:async(k:string)=>{map.delete(k);}};}
test('signed-out reconnect clears only the exact credential-bound deleted account',async()=>{
 const store=storage([proof('alice'),{...proof('bob'),deviceId:'c'.repeat(32)}]),cleared:string[]=[];
 const sync=createCleanupProofClient(store,{register:async uid=>proof(uid),check:async p=>({confirmed:p.uid==='alice',uid:p.uid})},async uid=>{cleared.push(uid);});
 await sync();assert.deepEqual(cleared,['alice']);assert.equal(JSON.parse(store.map.values().next().value!)[0].uid,'bob');
});
test('offline timeout, expired or mismatched proof never erases reminders',async()=>{
 for(const kind of ['network','expired','mismatch']){const p=proof('alice');if(kind==='expired')p.expiresAt=1;const store=storage([p]),cleared:string[]=[];const sync=createCleanupProofClient(store,{register:async uid=>proof(uid),check:async()=>{if(kind==='network')throw Error('offline');return {confirmed:true,uid:'bob'};}},async uid=>{cleared.push(uid);});await sync();assert.deepEqual(cleared,[]);}
});
test('interrupted local cleanup retains proof for restart and repeated foreground checks coalesce',async()=>{
 const store=storage([proof('alice')]);let locked=true,calls=0;
 const sync=createCleanupProofClient(store,{register:async uid=>proof(uid),check:async()=>{calls++;return {confirmed:true,uid:'alice'};}},async()=>{if(locked)throw Error('locked');});
 const a=sync(),b=sync();assert.equal(a,b);await assert.rejects(a);assert.equal(calls,1);assert.equal(store.map.size,1);locked=false;await sync();assert.equal(store.map.size,0);
});
test('one locked account does not prevent another confirmed account from clearing',async()=>{
 const store=storage([proof('alice'),{...proof('bob'),deviceId:'c'.repeat(32)}]),cleared:string[]=[];
 const sync=createCleanupProofClient(store,{register:async uid=>proof(uid),check:async p=>({confirmed:true,uid:p.uid})},async uid=>{if(uid==='alice')throw Error('locked');cleared.push(uid);});
 await assert.rejects(sync());assert.deepEqual(cleared,['bob']);const remaining=JSON.parse(store.map.values().next().value!);assert.equal(remaining.length,1);assert.equal(remaining[0].uid,'alice');
});
test('temporarily unavailable proof service preserves recovery credential until known finite expiry',async()=>{
 const store=storage([proof('alice')]);let available=false;const cleared:string[]=[];
 const sync=createCleanupProofClient(store,{register:async uid=>proof(uid),check:async()=>available?{confirmed:true,uid:'alice'}:{confirmed:false,unavailable:true}},async uid=>{cleared.push(uid);});
 await sync();assert.equal(store.map.size,1);assert.deepEqual(cleared,[]);available=true;await sync();assert.deepEqual(cleared,['alice']);assert.equal(store.map.size,0);
});
