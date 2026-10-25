# Account deletion — local request/review completion

Prepared locally only. No live jobs, policies, accounts, rules or Hosting were read or changed.

## Existing behavior retained

Edit Profile and the public deletion page submit a recently reauthenticated, explicitly confirmed request for the signed-in UID. Revoked tokens are rejected. A deterministic job ID and transaction prevent duplicate requests. Submitting a request does not disable the account or execute deletion.

## Prepared changes

- `getAccountDeletionStatus`: verified user sees only their own status and rejection reason; client-supplied target UIDs are ignored.
- `listAccountDeletionRequests`: verified, approved canonical Admin/VIP only; bounded, paginated pending queue ordered by last-attempt timestamp (submission time for untouched requests). Directory-safe name, submission date and status only.
- `reviewAccountDeletionRequest`: Admin/VIP role rechecked inside the transaction; no self-review; explicit decision, confirmation and reason; immutable review receipt. Duplicate retries return the recorded result. Conflicting decisions fail.
- Approval requires a complete owner-approved policy that the worker supports. Rejection remains available while policy work is held. Repeated resident submissions return the actual existing status, including rejection, rather than reporting a new request.
- Native review controls are within the existing Admin Portal Reports section. Resident status and refresh remain within Edit Profile. Public page uses the same request/status endpoints; no deployment here.
- Worker requires `TOWNLOOP_ACCOUNT_DELETION_ENABLED=true` AND independent per-job approval. It remains disabled by default. No worker activation is authorized. Legacy unreviewed jobs cannot be processed merely because a global policy exists.

## Remaining gates — do not activate

The owner previously selected 60 days for shared chat/Work Order history, RSVP/history, moderation/deletion audit records, and restricted backups. The prepared worker rejects timed policies: it does not implement the required end-of-period erasure/redaction. Do not replace that choice with indefinite retention or mark processing ready.

Owner decisions still needed: category-specific treatment at day 60 (delete, anonymize/redact, or a documented legal exception), which identifying fields shared records must retain during that period, and the operational reason for retention. Permanent Work Order number reservations remain distinct from resident-identifying history. Preserve the six quarantined files and their cleanup exclusions. Abandoned-upload cleanup remains off; backup expiry is an independent operational task.

Define a staffed review/completion target, escalation owner and permitted rejection grounds. Pagination and dated requests make backlog visible, but neither a button nor a scheduler can guarantee requests are handled without staffing/escalation. Rejected requests show the reason and direct the resident to the office for further review; automatic resubmission is not implemented.

Before an approved later rollout: deploy only the new read/review callables plus updated request-only callables, verify role restrictions using mocks/safe checks, then coordinate the client/public-page availability. Existing Firestore job access remains denied to clients, so no rules change is needed. Policy completion, destructive workers, media cleanup and public Hosting publication require separate approval. Google-provider accounts use the existing supported public reauthentication flow; native Google reauthentication remains unavailable in this checkpoint.
