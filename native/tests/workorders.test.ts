import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkOrder, queueState, resolutionPatch } from '../src/workorders/model.ts';
const order=readWorkOrder('one',{title:'Sink',status:'Queued',placeInLine:9});
test('queue uses the full newest-first live list and removes completed tickets from positions',()=>{
  const other=readWorkOrder('other',{status:'Submitted'});
  const done=readWorkOrder('done',{status:'Done'});
  assert.deepEqual(queueState(order,[done,other,order]),{done:false,inProgress:false,place:2,ahead:1});
  assert.deepEqual(queueState(order,[order,other]),{done:false,inProgress:true,place:1,ahead:0});
  assert.equal(queueState(order,[done]).place,9);
  assert.equal(queueState(order,[done]).ahead,8);
  assert.equal(queueState({...order,placeInLine:1},[]).inProgress,true);
  assert.equal(queueState(done,[done,order]).inProgress,false);
});
test('crew resolution requires a note with optional photo, is atomic with its comment, and is idempotent',()=>{
  const crew={id:'crew',role:'crew',name:'Crew',email:'crew@example.invalid'} as const;
  assert.throws(()=>resolutionPatch(order,crew,null,'now'));
  assert.throws(()=>resolutionPatch(order,{...crew,role:'resident'},null,'now'));
  const comment={id:'proof',author:'Crew',role:'Maintenance Crew',text:'Fixed sink',timestamp:'Just now',photoUrl:'https://example.invalid/proof.jpg'};
  const patch=resolutionPatch(order,crew,comment,'2026-10-03T00:00:00Z')!;
  assert.equal(patch.status,'Done');assert.equal(patch.comments.length,1);
  assert.equal(patch.completedBy,'Crew');assert.equal(patch.photoUrl,comment.photoUrl);
  assert.equal(resolutionPatch({...order,...patch},crew,comment,'later'),null);
  assert.throws(()=>resolutionPatch({...order,comments:[comment]},crew,null,'now'));
  assert.equal(resolutionPatch(order,crew,{...comment,photoUrl:''},'now')?.resolutionNote,'Fixed sink');
});
test('existing Firestore status, timestamps, resident identity and legacy photos remain intact',()=>{
  const existing=readWorkOrder('live',{status:'In Progress',userId:'resident',photoUrl:'legacy.jpg',completedAt:'time',createdAt:{toMillis:()=>123}});
  assert.equal(existing.status,'In Progress');assert.equal(existing.userId,'resident');
  assert.deepEqual(existing.photos,['legacy.jpg']);assert.equal(existing.createdAt,123);
  assert.equal(existing.completedAt,'time');
});


test('all original categories are unique and survive Firestore decoding for ticket views', async () => {
  const { WORK_ORDER_CATEGORIES } = await import('../../src/data/workOrderCategories.ts');
  assert.equal(WORK_ORDER_CATEGORIES.length, 9);
  assert.equal(new Set(WORK_ORDER_CATEGORIES.map(c => c.id)).size, 9);
  for (const category of WORK_ORDER_CATEGORIES) {
    const restored = readWorkOrder('saved-ticket', { category: category.name });
    assert.equal(restored.category, category.name);
    assert.equal(restored.categoryEmoji, category.emoji);
    assert.equal(readWorkOrder('legacy-ticket', { category: category.id }).categoryEmoji, category.emoji);
  }
  assert.equal(readWorkOrder('legacy', { category: 'General Maintenance' }).category, 'General Maintenance');
});

test('trusted completion timestamps render as dates', () => {
  assert.equal(readWorkOrder('done', {completedAt:{toDate:()=>new Date('2026-10-16T12:00:00Z')}}).completedAt,'2026-10-16T12:00:00.000Z');
});
