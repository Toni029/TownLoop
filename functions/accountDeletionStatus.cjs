// Deliberately exclude raw exceptions, UIDs, paths, tokens and evidence contents from clients.
const ISSUES=new Set(['verified_scope_write_freeze_required','cross_database_completion_required','reported_evidence_requires_disposition','legacy_identity_in_record_path','category_specific_redaction_required','legacy_chat_identity','media_link_requires_review','scope_media_pending','policy_changed_or_incomplete','processing_permission_or_schema_requires_review','retry_required','profile_identity_conflict']);
function processingSummary(job){
 const phases={requested:'awaiting_authorization',scoped_freeze:'securing_access',scoped_drain:'securing_access',scoped_run:'processing_records',scoped_auth:'verifying_completion',scoped_retention:'retention_pending'};
 return {processingStage:Object.hasOwn(phases,job.phase)?phases[job.phase]:null,processingIssue:ISSUES.has(job.lastError)?job.lastError:job.status==='failed'?'retry_required':job.status==='needs_review'?'manual_review_required':null};
}
module.exports={processingSummary};
