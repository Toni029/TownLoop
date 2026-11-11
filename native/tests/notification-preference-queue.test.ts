import test from 'node:test';import assert from 'node:assert/strict';
import {preferenceQueue} from '../src/notifications/preferenceQueue';import {emptyPreferences} from '../src/notifications/protocol';
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return{promise,resolve};};
test('tap updates immediately during hydration; untouched stored choices survive',async()=>{
 const load=deferred();let disk={...emptyPreferences,marketplace:true};
 const q=preferenceQueue({load:async()=>{await load.promise;return disk;},persist:async v=>{disk={...v};},sync:async()=>{},changed:()=>{}});
 q.set('inbox',true);assert.equal(q.snapshot().values.inbox,true);load.resolve();await flush();assert.equal(disk.inbox,true);assert.equal(disk.marketplace,true);q.dispose();
});
test('rapid taps and independent categories persist while an older network request is slow; last intent wins',async()=>{
 let disk={...emptyPreferences},server={...emptyPreferences};const first=deferred(),last=deferred();let calls=0;
 const q=preferenceQueue({load:async()=>disk,persist:async v=>{disk={...v};},sync:async()=>{const value={...disk};calls++;await(calls===1?first:last).promise;server=value;},changed:()=>{}});await flush();
 q.set('inbox',true);await flush();q.set('inbox',false);q.set('discussion',true);q.set('marketplace',true);q.set('inbox',true);q.set('inbox',false);await flush();
 assert.equal(calls,1);assert.equal(q.snapshot().values.inbox,false);assert.equal(disk.discussion,true);assert.equal(disk.marketplace,true);assert.equal(disk.inbox,false);
 first.resolve();await flush();assert.equal(calls,2);assert.equal(q.snapshot().values.discussion,true);last.resolve();await flush();assert.deepEqual(server,disk);assert.equal(q.snapshot().phase,'saved');q.dispose();
});
test('network failure retains durable intent with explicit pending state; reopening can sync without another tap',async()=>{
 let disk={...emptyPreferences};const q=preferenceQueue({load:async()=>disk,persist:async v=>{disk={...v};},sync:async()=>{throw Error('offline');},changed:()=>{}});await flush();q.set('workorders',true);await flush();
 assert.equal(q.snapshot().phase,'pending');assert.equal(disk.workorders,true);assert.equal(q.snapshot().values.workorders,true);q.confirmed(q.version());assert.equal(q.snapshot().phase,'saved');q.dispose();
 const reopened=preferenceQueue({load:async()=>disk,persist:async()=>{},sync:async()=>{},changed:()=>{}});await flush();assert.equal(reopened.snapshot().values.workorders,true);reopened.dispose();
});
test('local storage failure rolls back the latest unsaved selection instead of pretending it was saved',async()=>{
 const q=preferenceQueue({load:async()=>({...emptyPreferences}),persist:async()=>{throw Error('storage');},sync:async()=>{assert.fail('must not send an unsaved preference');},changed:()=>{}});await flush();q.set('inbox',true);assert.equal(q.snapshot().values.inbox,true);await flush();assert.equal(q.snapshot().values.inbox,false);assert.equal(q.snapshot().phase,'local-error');q.dispose();
});
test('stale refresh and old-account completion cannot overwrite new selections or publish into another account',async()=>{
 const pending=deferred();let notifications=0;
 const q=preferenceQueue({load:async()=>({...emptyPreferences}),persist:async()=>{},sync:async()=>pending.promise,changed:()=>{notifications++;}});await flush();const before=q.version();q.set('discussion',true);await flush();assert.equal(q.hydrate({...emptyPreferences},before),false);assert.equal(q.snapshot().values.discussion,true);
 q.dispose();const count=notifications;pending.resolve();await flush();assert.equal(notifications,count);
 const other=preferenceQueue({load:async()=>({...emptyPreferences}),persist:async()=>{},sync:async()=>{},changed:()=>{}});await flush();assert.deepEqual(other.snapshot().values,emptyPreferences);other.dispose();
});

test('an earlier local save failure cannot roll back a later selection',async()=>{
 let disk={...emptyPreferences},attempt=0;const first=deferred();
 const q=preferenceQueue({load:async()=>disk,persist:async values=>{if(++attempt===1){await first.promise;throw Error('first save failed');}disk={...values};},sync:async()=>{},changed:()=>{}});await flush();
 q.set('inbox',true);await flush();q.set('inbox',false);q.set('discussion',true);first.resolve();await flush();assert.equal(q.snapshot().values.inbox,false);assert.equal(disk.discussion,true);assert.equal(q.snapshot().phase,'saved');q.dispose();
});
test('failed initial storage reads never overwrite unknown saved preferences',async()=>{
 let writes=0;const q=preferenceQueue({load:async()=>{throw Error('locked storage');},persist:async()=>{writes++;},sync:async()=>{assert.fail('must not register unknown preferences');},changed:()=>{}});
 await flush();q.set('inbox',true);await flush();assert.equal(writes,0);assert.equal(q.snapshot().values.inbox,false);assert.equal(q.snapshot().phase,'load-error');q.dispose();
});
