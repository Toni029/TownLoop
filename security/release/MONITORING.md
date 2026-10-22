# Preferred monitoring: Crashlytics + Google Cloud Monitoring

Prepared 2026-10-21. No Firebase app registration, credentials, SDK installation, telemetry, alert creation or native build occurred. This is a configuration handoff, not a claim monitoring is operational.

## Native crash reporting

Use `@react-native-firebase/app` and `@react-native-firebase/crashlytics` together. Registry peer metadata checked today for matching **27.0.0**: Expo >=47, RN >=0.60 for app; Crashlytics pins app 27.0.0. Native currently uses Expo 57/RN 0.86 New Architecture. Peer ranges permit preparation, but do not prove a successful native build. Preserve the current JS Firebase Auth/Firestore SDK: adding the native App module for Crashlytics is not permission to migrate authentication or create a second Firebase project.

`monitoring.native.fragment.json` lists the exact proposed packages/plugins. It is NOT merged into active app config: missing files or a blind install would break the existing preview. Require Firebase **client** configuration for existing `com.toni029.townloop`: Android `google-services.json`, later iOS `GoogleService-Info.plist`, stored as controlled EAS file variables. These are client app configuration, not service-account keys. Confirm project/package matches and preserve signing. Verify whether those native Firebase apps already exist; register only with explicit account authorization if absent.

RNFirebase's current Expo instructions require config plugins; its iOS SPM setup uses dynamic frameworks via Expo-compatible `expo-build-properties` (~57.0.22 from installed Expo's bundled module table). No static-framework override or Expo upgrade is proposed. Native dependencies require a new APK/iOS binary, never OTA. Expo Go does not provide this module.

Collection defaults in the fragment are OFF. Owner must approve telemetry disclosure, consent behavior, retention and access. Leave automatic JS exception capture disabled until payload review; wire the existing diagnostic sink to **static error codes only**, never pass caught Error/stack/props automatically. No user ID/email, ticket text, URLs, message content, medication or custom breadcrumbs. Disable Analytics breadcrumbs unless separately approved. Native crash stacks/device metadata are still diagnostic personal data and require accurate disclosure; no zero-PII claim.

During the authorized build phase: merge the reviewed fragment, install matching versions/lock resolution once, set validated file variables, verify symbol/mapping upload for that release, add release/channel/runtime metadata without resident identifiers, and validate a synthetic crash on an authorized test build. Never test by crashing a resident session. Verify opt-out/collection state before distributing. The present static-code error boundary remains useful while Crashlytics is unconfigured.

Sources: [Expo integration](https://rnfirebase.io/#expo), [Crashlytics native setup and collection controls](https://rnfirebase.io/crashlytics/usage), [Firebase data collection customization](https://firebase.google.com/docs/crashlytics/customize-crash-reports?platform=android).

## Cloud Monitoring operations

`cloud-monitoring.template.json` is an inactive specification. Owner must supply the approved new API hostname/service, notification channels and budgets; do not replace or probe resident endpoints. Use `/api/health` only for uptime; it returns status, not resident data. Deploy the existing Express newsletter API separately behind HTTPS, not by replacing Firebase Hosting. It currently listens on port 3000 and uses server-local PDF storage; provision durable private storage/single-instance behavior or approve a persistent deployment before relying on uploaded files across restarts. A stateless multi-instance Cloud Run deployment cannot silently assume local PDFs persist.

Configure Cloud Monitoring for Cloud Run/2nd-gen Functions request failures/latency, instance caps, Scheduler failures, Firestore/Storage usage/quota errors and policy-gated job failures/backlogs. Do not export resident document bodies into logs or metric labels. Exclude Auth headers, request bodies, signed/download URLs and private file paths; use static error codes. Existing log messages containing IDs need operator log access/retention controls; no public dashboard.

Suggested initial alerts for owner approval: HTTPS health failure for 5 minutes; server 5xx ratio >5% with at least 20 requests over 5 minutes; Scheduler execution failure; quota errors; deletion/media jobs stuck after the approved service SLA. These thresholds are proposals, not retention rules or active monitors. Billing budgets notify; they are not hard spending caps. Do not treat job-policy holds as permission to enable cleanup.

Use existing project roles where sufficient; enable APIs/notification channels with owner approval, never create service accounts/keys automatically. Restrict dashboard/log access and verify one harmless alert delivery in the approved environment. [Cloud Monitoring uptime checks](https://cloud.google.com/monitoring/uptime-checks/introduction) complement Crashlytics; they do not measure native UI frame rates.
