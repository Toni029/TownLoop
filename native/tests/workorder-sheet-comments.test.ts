import test from 'node:test';
import assert from 'node:assert/strict';
import {readWorkOrder,removeResolutionComment,editableResolution,resolutionPatch} from '../src/workorders/model.ts';
import {sheetStops,sheetDestination} from '../src/workorders/sheetGeometry.ts';
test('viewport snap points stay finite and ordered across sizes and keyboard resize',()=>{
  for (const [h,inset] of [[800,44],[400,24],[1024,59],[1,44]]) {
    const s=sheetStops(h,inset);
    assert.ok(s.full>=0 && s.half>=s.full && s.hidden>s.half);
    assert.equal(sheetDestination(s.full,0,s.full,s.half),'full');
    assert.equal(sheetDestination(s.half,0,s.full,s.half),'half');
    assert.equal(sheetDestination(s.half,1000,s.full,s.half),'close');
    assert.equal(sheetDestination(s.half,-1000,s.full,s.half),'full');
  }
});
test('manager deletion preserves status, other comments and audit; missing resolution can complete again',()=>{
  const crew={id:'crew',name:'Crew',role:'crew',email:'crew@example.invalid'} as const;
  const note={id:'other',author:'Crew',role:'Maintenance Crew',text:'Inspection note',timestamp:'Yesterday'};
  const done=resolutionPatch(readWorkOrder('one',{status:'Queued',comments:[note]}),crew,{id:'fix',author:'Crew',role:'Maintenance Crew',text:'Fixed',timestamp:'Today'},'now')!;
  const order=readWorkOrder('one',{...done});
  for(const role of ['admin','vip'] as const){
    const result=removeResolutionComment(order,{...crew,role},'fix','today')!;
    assert.deepEqual(result.comments,[note]);assert.equal(result.audit.comment.text,'Fixed');
    assert.equal(order.status,'Done');assert.equal(order.comments?.length,2);
    const reopened={...order,status:'In Progress' as const,comments:result.comments,resolutionNote:undefined,resolutionCommentId:undefined,resolutionAuthorId:undefined};
    assert.equal(editableResolution(reopened,crew),null);
    assert.equal(resolutionPatch(reopened,crew,{...note,id:'new',text:'Fixed again'},'later')?.comments.length,2);
  }
  for(const role of ['crew','resident'] as const) assert.throws(()=>removeResolutionComment(order,{...crew,role},'fix','today'));
  assert.throws(()=>removeResolutionComment(order,{...crew,role:'admin'},'other','today'));
});
