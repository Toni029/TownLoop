# One-tap, individual Inbox leaving — local only

The published client still selected its legacy team-side deletion path when Stage A
was unavailable. It displayed the team-wide confirmation and attempted `sideLeft`
and client-authored system-message writes. The previously reviewed notification
rules allow neither those membership fields nor fraudulent system-message appends.
This explains the policy mismatch; no fresh live rules/log inspection is claimed.

Both list/header trash controls now use one direct leave action, with a busy lock,
no confirmation state, and no optimistic list removal/navigation/draft clearing.
Failures remain visible and distinguish pending rollout, authorization and connectivity.
All legacy team-side writes/direct deletions were removed from this native action.
`leaveLegacy` is a backend-only atomic transaction: verified source conversion plus
only the authenticated actor leaving. Invalid ownership or transaction failure leaves
the source unchanged. Existing migrated sources use the same per-member operation.
Final-member leave queues held cleanup with no extra confirmation or deletion.

Live operation requires the separately approved Stage A callable/default rules and
indexes, capability activation, and reviewed manifests for ambiguous legacy staff
membership. No permission broadening or rule changes were made in this correction.
Stage B remains unexported/disabled. Marketplace and notification code are unchanged.
