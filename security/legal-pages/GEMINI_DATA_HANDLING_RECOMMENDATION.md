# Separate Gemini data-handling recommendation

Prepared November 12, 2026. This is a recommendation, not an implementation or billing
change. The authorized release is Hosting only. No Gemini configuration, API key,
backend function, native app or resident data was changed.

## Confirmed configuration

The deployed `newsletterApi` and `runNewsletterAnalysis` use the existing Secret
Manager key. A secure in-memory key lookup identified its actual owning Google
project; that project's Cloud Billing metadata reports `billingEnabled: false`.
Billing on the separate Firebase project does not establish paid Gemini handling.
No key value was logged or committed. No analysis was invoked during this check.

Google's current unpaid-service terms allow submitted content/results to be used
for product/model improvement and human review, and instruct users not to submit
personal, sensitive or confidential information. Regional exceptions are described
in Google's terms. Paid-service terms have different data-use protections but do
not promise zero retention or a fixed processing country. Do not equate upgrading
billing with automatic privacy/legal compliance.

## Actual feature paths

| Feature | Data that may leave TownLoop | Current pathway and confidence |
| --- | --- | --- |
| Newsletter RSVP/highlight extraction and independent coverage processing | PDF content: page images and/or text, names/photos, event details and any personal information present on the supplied pages; extracted results | Confirmed deployed Gemini analysis implementation. Retained PDFs can be analyzed again without reuploading. |
| Work Order English/Spanish translation and Crew response composer | Request title, description, selected comments or the drafted response | Native default calls deployed `translateWorkOrder` revision `translateworkorder-00001-foh`. Its deployed source uses Google Cloud Translation and has no Gemini call. This is a separate service. Installed-device endpoint overrides were not inspected in this task. |
| Existing server `/api/translate` implementation | Same supplied maintenance text, potentially addresses, names or other sensitive details | Retired web `server/translation.ts` contains a Gemini fallback. The deployed newsletter bundle has no `/api/translate` route or this fallback. It is not a confirmed active native feature. Do not reintroduce it in a future server without the same safeguards. |
| Medication and Daily Checklist records | None automatically | Account-scoped local device storage; no automatic Gemini integration. Deliberately copying their contents into AI-processed documents/text is different. |
| Inbox, Marketplace, discussion messages/posts, profiles, weather and push delivery | No automatic Gemini submission found in the inspected native paths | Normal Firebase/Expo/weather operation is separate. Including their contents in a newsletter or translation can disclose them through that explicit AI action. |

Code references: `server/newsletterExtractor.ts`, `server/newsletterJobs.ts`,
`server/translation.ts`, `server.ts`, `functions/translation.cjs`,
`native/src/workorders/translator.ts`, `native/src/home/store.ts` and
`native/src/localData/nativeStorage.ts`. No resident PDF, ticket or message was read.

## Recommended next controlled change — requires separate approval

1. **Immediate operational precaution:** do not analyze resident-identifiable
   newsletters with the current unpaid Gemini route. Use the existing no-AI
   newsletter publishing path where appropriate; upload/reader/publishing need
   not be rebuilt. Do not route private maintenance text to the retired Gemini fallback in any future integration.
   No server pause or gate has been activated by this recommendation.
2. **Server-enforced protection:** after approval, add a narrow fail-closed gate to
   analysis admission, queued/resumed analysis and any future Gemini translation fallback.
   Unverified/unpaid data-processing configuration must reject before sending file
   bytes, text or prompts to Google. Client warnings alone are insufficient. Keep
   uploads, retained PDFs, the existing publication and reader intact. Review any
   already-queued work before enabling the gate; do not delete retained PDFs.
3. **Preferred service setup:** separately approve a paid Gemini project/billing
   arrangement using an appropriately verified existing key/project where suitable.
   Do not create/rotate keys unnecessarily. Verify the actual key project and paid
   API status, applicable processing terms, access, regions and account settings
   before allowing personal-data analysis. Then update disclosures/Data Safety to
   match the verified configuration. Do not promise that payment eliminates all
   logging or human-access/security obligations.
4. **Minimize inputs regardless of tier:** strip unnecessary contact/address/health
   details from AI inputs while preserving the original newsletter PDF for readers.
   Any future redaction flow must inspect page imagery as well as text; text-only
   removal cannot protect personal information inside photographs or scanned pages.
   Require editor review and clear errors, not silent redaction that breaks event
   extraction. This is future scoped work, not a change made under Hosting approval.
5. **Verification before resuming:** synthetic checks proving no external Gemini
   request occurs when gated, including retries/background tasks/fallbacks; then a
   consented non-sensitive sample under the verified provider configuration. Do not
   use real resident information as a connectivity test or log prompts/documents.

## Existing-content limitation

This investigation did not enumerate prior Gemini-submitted documents or provider
logs. It cannot prove whether historical submissions included personal information,
retrieve them from Google or retroactively change Google's handling. Do not claim
that any prior provider copies are erased. Any historical exposure assessment or
provider deletion request requires separately scoped approval and secure handling.

Sources checked November 12, 2026:
- https://ai.google.dev/gemini-api/terms
- https://ai.google.dev/gemini-api/docs/billing

The deployed translation source was inspected read-only, without invoking translation
or reading its secret value; evidence is in `translation-readonly-verification.json`.
Only newsletter analysis is confirmed to send data to Gemini in the deployed native
backend paths examined. Broader historical configurations were not inferred.
