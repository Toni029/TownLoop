import test from 'node:test';
import assert from 'node:assert/strict';
import {deletionStatusText} from '../src/lib/deletionStatus.ts';
test('deployed review-only responses remain compatible and never imply approval deleted an account',()=>{
 assert.match(deletionStatusText({status:'approved_held'}),/has not been deleted/);
 assert.match(deletionStatusText({status:'processing'}),/in progress/);
 assert.match(deletionStatusText({status:'retention_pending'}),/not fully complete/);
 assert.match(deletionStatusText({status:'failed'}),/retry is required/);
});
test('recognized server stages and blockers explain incomplete processing without rendering arbitrary server text',()=>{
 assert.match(deletionStatusText({status:'processing',processingStage:'verifying_completion'}),/both databases/);
 assert.match(deletionStatusText({status:'needs_review',processingIssue:'reported_evidence_requires_disposition'}),/reported evidence/);
 assert.match(deletionStatusText({status:'pending_owner_approval',processingIssue:'verified_scope_write_freeze_required'}),/both databases/);
 for(const status of ['failed','needs_review','processing'])assert(!deletionStatusText({status,processingIssue:'private raw content',processingStage:'private raw content'}).includes('private raw content'));
});

test('unknown and prototype-like server fields remain harmless display strings',()=>{
 for(const value of ['__proto__','constructor','unknown']){assert.equal(typeof deletionStatusText({status:value}),'string');assert.equal(typeof deletionStatusText({status:'failed',processingIssue:value}),'string');assert.equal(typeof deletionStatusText({status:'processing',processingStage:value}),'string');}
});
test('v3 rejection permits a fresh verified request and retries never imply completion',()=>{
 assert.match(deletionStatusText({status:'rejected'}),/new verified request/);
 assert.match(deletionStatusText({status:'retrying'}),/not complete/);
});

test('v3 completion describes verified personal-data cleanup with separately retained receipts',()=>{
 assert.match(deletionStatusText({status:'complete',workflowVersion:3}),/personal-data cleanup/);
 assert.match(deletionStatusText({status:'complete',workflowVersion:3}),/receipts/);
});
