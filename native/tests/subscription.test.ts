import test from 'node:test';
import assert from 'node:assert/strict';
import {subscribeSafely} from '../src/lib/subscription.ts';
test('native collection subscriptions detach once and ignore late values/errors after account switch or unmount',()=>{
  let next!:(value:number)=>void, fail!:(error:unknown)=>void, stopped=0;
  const values:number[]=[],errors:unknown[]=[];
  const stop=subscribeSafely<number>((n,e)=>{next=n;fail=e;return()=>{stopped++;};},v=>values.push(v),e=>errors.push(e));
  next(1);fail('offline');stop();next(2);fail('late');
  assert.deepEqual(values,[1]);assert.deepEqual(errors,['offline']);assert.equal(stopped,1);
});
