import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountCleanupQueue} from '../src/localData/accountCleanupQueue.ts';
test('interrupted confirmed cleanup retries across restarts without touching another account',async()=>{
 const data=new Map<string,string>(),cleared:string[]=[];
 const storage={getItem:async(k:string)=>data.get(k)||null,setItem:async(k:string,v:string)=>{data.set(k,v);},removeItem:async(k:string)=>{data.delete(k);}};
 const first=createAccountCleanupQueue(storage,async()=>{throw Error('device locked');});await assert.rejects(first.enqueue('alice'));
 const next=createAccountCleanupQueue(storage,async(uid:string)=>{cleared.push(uid);});await next.retry();await next.retry();assert.deepEqual(cleared,['alice']);assert.equal(data.size,0);
});
test('concurrent cleanup events preserve retry state and one failed account does not block another',async()=>{
 const data=new Map<string,string>(),cleared:string[]=[];
 const storage={getItem:async(k:string)=>data.get(k)||null,setItem:async(k:string,v:string)=>{data.set(k,v);},removeItem:async(k:string)=>{data.delete(k);}};
 const queue=createAccountCleanupQueue(storage,async(uid:string)=>{if(uid==='alice')throw Error('locked');cleared.push(uid);});
 const result=await Promise.allSettled([queue.enqueue('alice'),queue.enqueue('bob')]);assert.equal(result[0].status,'rejected');assert.deepEqual(cleared,['bob']);assert.deepEqual(JSON.parse([...data.values()][0]),['alice']);
});
test('malformed local proof never triggers account erasure',async()=>{
 const storage={getItem:async()=> '["../../other"]',setItem:async()=>{},removeItem:async()=>{}};let cleared=false;
 await assert.rejects(createAccountCleanupQueue(storage,async()=>{cleared=true;}).retry());assert.equal(cleared,false);
});
test('another locked account cannot suppress completion of the current confirmed account',async()=>{
 const data=new Map<string,string>([['townloop_account_cleanup_pending_v1','["alice","bob"]']]),completed:string[]=[];
 const storage={getItem:async(k:string)=>data.get(k)||null,setItem:async(k:string,v:string)=>{data.set(k,v);},removeItem:async(k:string)=>{data.delete(k);}};
 const queue=createAccountCleanupQueue(storage,async(uid:string)=>{if(uid==='alice')throw Error('locked');},async(uid:string)=>{completed.push(uid);});
 await assert.rejects(queue.retry());assert.deepEqual(completed,['bob']);assert.deepEqual(JSON.parse([...data.values()][0]),['alice']);
});
test('interrupted completion retains proof and retries without clearing an unrelated account',async()=>{
 const data=new Map<string,string>(),completed:string[]=[];let locked=true;
 const storage={getItem:async(k:string)=>data.get(k)||null,setItem:async(k:string,v:string)=>{data.set(k,v);},removeItem:async(k:string)=>{data.delete(k);}};
 const queue=createAccountCleanupQueue(storage,async()=>{},async(uid:string)=>{if(locked)throw Error('interrupted');completed.push(uid);});
 await assert.rejects(queue.enqueue('alice'));assert.equal(data.size,1);locked=false;await queue.retry();assert.deepEqual(completed,['alice']);assert.equal(data.size,0);
});
