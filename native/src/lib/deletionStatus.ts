export type DeletionRequestStatus = { status: string; processingStage?: string | null; processingIssue?: string | null; jobId?: string; createdAt?: number | null; reviewedAt?: number | null; reason?: string; processingHeld?: boolean; reviewDueAt?: number; escalateAt?: number; retentionDueAt?: number; completionDueAt?: number | null; reviewOverdue?: boolean; escalated?: boolean; processingOverdue?: boolean; retentionOverdue?: boolean };
export function deletionStatusText(request: DeletionRequestStatus): string {
  const labels: Record<string, string> = {
    waiting_for_media:'Verified record processing is waiting for attachment cleanup; account deletion is not complete.',
    delayed:'Request delayed for a documented legal/security reason; original deadlines remain in effect.', needs_review:'Processing needs office review; unresolved items have not been marked complete.', failed:'Processing was interrupted. Deletion is not complete; a retry is required.', retention_pending:'Account access removed. Retained receipts still await expiry; deletion processing is not fully complete.', none: 'No deletion request submitted.', requested: 'Awaiting Admin/VIP review.',
    approved_held: 'Approved. Processing is paused until deletion safeguards are verified. Your account has not been deleted.',
    queued: 'Approved. Awaiting authorized processing.', processing: 'Deletion processing is in progress.',
    pending_owner_approval: 'Processing is paused until retention and database safeguards are verified.',
    identity_complete_media_pending: 'Account removed; associated media cleanup is pending.',
    complete: 'Deletion processing completed under the approved retention policy.',
    rejected: 'Request closed after documented withdrawal. Contact the office if this is incorrect.',
  };
  const issues: Record<string,string> = {
    verified_scope_write_freeze_required:'Processing is paused: account writes must be secured in both databases.',
    cross_database_completion_required:'Processing is incomplete: both databases must confirm completion.',
    reported_evidence_requires_disposition:'Processing is paused for a documented decision about reported evidence.',
    legacy_identity_in_record_path:'Processing is paused for review of an older conversation identifier.',
    category_specific_redaction_required:'Processing is paused: a record needs a supported privacy-safe removal procedure.',
    legacy_chat_identity:'Processing is paused: older conversation ownership needs verification.',
    media_link_requires_review:'Processing is paused: attachment ownership or cleanup needs verification.',
    scope_media_pending:'Attachment cleanup is pending. Deletion is not complete.',
    policy_changed_or_incomplete:'Processing is paused until the approved retention safeguards are verified.',
    profile_identity_conflict:'Processing is paused: account ownership needs verification.',
    processing_permission_or_schema_requires_review:'Processing is paused for an authorization or record-format review.',
    retry_required:'Processing was interrupted. Deletion is not complete; a retry is required.',
    manual_review_required:'Processing is paused for office review. Unresolved data has not been marked complete.',
  };
  const issue=request.processingIssue&&Object.hasOwn(issues,request.processingIssue)?issues[request.processingIssue]:null;
  if(issue&&['needs_review','failed','pending_owner_approval','waiting_for_media'].includes(request.status))return issue;
  const stages: Record<string,string> = {securing_access:'Processing: securing account access.',processing_records:'Processing: handling verified account records.',verifying_completion:'Processing: verifying completion across both databases.'};
  if(request.status==='processing'&&request.processingStage&&Object.hasOwn(stages,request.processingStage))return stages[request.processingStage];
  return Object.hasOwn(labels,request.status)?labels[request.status]:'Request requires office review.';
}
