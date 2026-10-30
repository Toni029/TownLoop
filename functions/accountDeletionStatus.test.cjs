const test=require('node:test'),assert=require('node:assert/strict');
const {processingSummary}=require('./accountDeletionStatus.cjs');
test('public status exposes only allowlisted phase/error labels, never raw exception metadata',()=>{
 assert.deepEqual(processingSummary({phase:'scoped_run',lastError:'reported_evidence_requires_disposition'}),{processingStage:'processing_records',processingIssue:'reported_evidence_requires_disposition'});
 const output=processingSummary({status:'failed',phase:'private/uid',lastError:'private body / token',blockedDatabase:'private database'});
 assert.deepEqual(output,{processingStage:null,processingIssue:'retry_required'});
 assert(!JSON.stringify(output).includes('private'));
});
