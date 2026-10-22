# Sensitive local data (H7) and medication disclosure (H6)

## Release requirement

A **new native binary is required before public release**. SDK 57's installed
`expo/bundledNativeModules.json` specifies `expo-secure-store: ~57.0.4`; that
version is now in native package.json and package-lock.json. The fingerprint
runtime policy must remain enabled. No APK, release, account migration, server
migration, or deployment was performed by this change.

Older binaries without ExpoSecureStore remain usable: a capability probe runs
before requiring the JS module. They retain existing AsyncStorage behavior and
show an explicit medication tile notice that secure storage requires an app
update. **Those binaries still store medication records and Firebase Auth state
in plaintext app storage. They do not satisfy H7 for public release.** Native web
preview has the same capability limitation; the browser product's separate React
medication tile uses encrypted per-UID IndexedDB persistence as described below.

## Native medication and reminder records

`native/src/localData/nativeStorage.ts` supplies a protected adapter to HomeStore.
The adapter migrates the entire existing `townloop:home:v1:<uid>` object, including
medications and reminders, into OS secure storage. It keeps the UID namespace and
all JSON fields. It validates HomeData before migration. It never substitutes
empty medication records when reading corrupt/unavailable data.

`chunkedStorage.ts` chunks by Unicode code point, 350 characters (at most 1,400
UTF-8 bytes) per item, below the historical 2 KB Keychain limit. A value may use
at most 1,024 chunks. A larger record raises a visible storage failure and keeps
its original source; it is never truncated. This is a conservative compatibility
bound, not a claim that OS storage will accept every value up to that size.

Writes use two banks: write the inactive bank, read back every chunk, commit a
small manifest, then read back that manifest and its complete value. An
interruption before commit retains the previous bank. The original AsyncStorage
record is removed only after the secure value has been verified. A subsequent
read finishes removal if interruption occurred after commit. Invalid or missing
chunks, capacity errors, storage errors, or divergent secure/legacy records stop
loading and preserve existing records. Divergent legacy data needs a reviewed
recovery path; no automatic winner is selected. The UI already offers retry.

The chunks use Expo SecureStore's Android Keystore-backed encrypted preferences
and iOS Keychain. iOS uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The unused prior bank
can retain an encrypted previous version until reuse or explicit account cleanup.
This is not secure forensic erasure. OS compromise, rooted devices, unlocked
shared-device use, and screenshots are outside this protection.

## Firebase Auth

Firebase initializes with its supported `getReactNativePersistence` API, using the
same verified chunked adapter on capable binaries. This includes arbitrarily
sized token-bearing Firebase JSON without placing it into one Keychain value.
Existing Firebase AsyncStorage keys migrate lazily on the SDK's read. Sign out
uses Firebase's own removal operations for auth records. A failed storage operation
is surfaced to Firebase rather than silently falling back to plaintext on a
capable binary. Older binaries retain the prior AsyncStorage persistence for
compatibility and require upgrading. Firebase Auth also keeps the signed-in user
in memory while running. Auth items use `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` so
normal background token persistence remains available after the first device
unlock, while medication items require the device to be unlocked.
Background/locked-device Keychain availability and real
sign-in/refresh/sign-out must be exercised on physical devices before release.

## Logout and deletion API

Ordinary logout preserves UID-scoped native medications for later sign-in; it does
not erase residents' medication lists. UI unmounting/account identity boundaries
prevent another account from loading those records. Explicit account deletion calls
`clearResidentHomeData(uid)` from `native/src/localData/nativeStorage.ts`; it
removes that UID's plaintext record plus both encrypted banks and manifests,
including partially written chunks tracked by a high-water mark. Failures reject
and must be reported/retried; success must not be claimed while cleanup failed.
This API cannot clear another installation or a lost/offline device.

`src/localData/medications.ts` exports async `clearSessionMedications(uid)` for the browser
account-deletion flow. It deletes the UID’s encrypted record and key; callers must await it. No cleanup helper should be called with a different UID.

## Backup exclusions

The Expo config plugin `native/plugins/withLocalDataProtection.cjs` sets
`android:allowBackup=false` and explicit Android backup rules. Both legacy full
backup and Android 12+ cloud/device-transfer rules exclude root, file, database,
sharedpref, external and device-protected data domains. Shared preferences include
SecureStore encrypted files; databases/files include old AsyncStorage records.
The SecureStore plugin's own Android rules are disabled to avoid conflicting
resource references. These flags protect new binaries only; old backups cannot
be retroactively revoked, and OEM backup behavior needs physical-device review.

iOS Keychain items use the non-migrating THIS_DEVICE_ONLY class. At native launch,
the custom plugin marks Documents and Library with `isExcludedFromBackup` before
Firebase/React startup, covering existing plaintext app files as well. There is
no fictitious Info.plist backup flag. Failure logs a generic message without data;
a changed/non-Swift app delegate fails plugin application so it must be reviewed.
iOS Keychain entries can survive uninstall/reinstall on the same device. Account
UID scoping and explicit deletion still apply; uninstall is not an erasure claim.

Before release run Expo prebuild on a clean checkout and inspect both generated
Android XML resources/manifest and Swift AppDelegate, then test backup/restore and
signed-in medication migration on physical Android and iOS devices. No native
build or device backup test was performed here.

## Browser medication privacy

Browser medications persist per resident UID in IndexedDB database
`townloop-private-medications` (version 1), object store `residents`, keyed by the
raw UID string. Each atomic record contains `{version:1, key, iv, ciphertext}`:
a nonextractable AES-256-GCM CryptoKey, fresh 96-bit IV and encrypted JSON. The UID
and schema version are authenticated as additional data, preventing another UID's
record from being silently accepted. CryptoKey structured cloning preserves the
nonextractable flag across page refreshes. No medication details go into new
localStorage or sessionStorage entries. Browser records survive refresh and normal
logout; site-data clearing, eviction or profile loss can remove them.

This is browser encryption, **not a vault**. The key lives alongside the encrypted
record in the same browser profile. Same-origin scripts can ask WebCrypto to use
it, and this does not guarantee protection against XSS, a compromised browser or
someone copying/controlling the browser profile. A trusted device remains needed.

The UI loads the current UID asynchronously and prevents changes before successful
load. Account switching remounts the editor, clearing the prior UID's displayed
records. Writes serialize within the app and use a per-UID Web Lock across tabs
where supported. A write must commit its IndexedDB transaction and pass a fresh
decrypt/readback comparison before the UI acknowledges success. Load/decrypt or
save errors are visible and do not replace stored records with empty defaults;
the edit modal retains input on save failure. Unsupported HTTPS/WebCrypto/IndexedDB
contexts fail visibly without falling back to new plaintext persistence.

The historical `cecil_pines_medications_v1` key has no owner identifier. It is
never automatically shown or assigned to whoever signs in next, and is never
automatically erased. A notice offers an explicit copy to the current resident's
encrypted records (validated, merged by record ID, and acknowledged only after
verified durable write). The original is kept until a separate confirmed permanent
removal, so a failed import cannot erase it. Account deletion cannot attribute this
legacy key; residents may remove it explicitly using the notice.

`clearSessionMedications(uid)` is now **async**: it removes the UID's encrypted
IndexedDB record and its CryptoKey together, verifies absence, clears its cached
memory, then broadcasts `{uid,type:'deleted'}` on
`townloop-medication-deletion` so open matching resident tiles clear their displayed
records and disable edits. A separate public deletion page uses the same database
contract. Web Locks use `townloop-medications:<uid>` where available. A separate
browser profile/device or a tab without supported cross-tab coordination cannot
be remotely erased by this local cleanup helper. Account cleanup must await errors.

## H6 disclosure

Both medication tiles visibly state: personal tracking only, not medical advice;
follow clinician directions; reminders are not guaranteed and require another
reliable reminder. These are user-entered tracking records, not dosage advice or
guaranteed notification delivery.

## Local verification

Focused tests cover large Unicode and token JSON, UID isolation, interruptions at
each migration write, rollback after update failure, explicit cleanup of partial
writes, corrupt/conflicting source preservation, capacity limits, readback failure,
Firebase-style remove/re-auth sequencing, backup-plugin generation/idempotence, and browser
AES-GCM persistence/readback, UID isolation, tamper rejection, failures and IndexedDB commit timing.
Device migration, Keychain/Keystore operation and actual backup behavior remain
mandatory release checks.

## Scope limitations

The original web application's DailyMedications uses the encrypted IndexedDB adapter. The Expo web development preview uses the native module capability fallback and retains its existing browser AsyncStorage records with the upgrade warning; it must not be represented as having native Keychain protection. Existing mixed-user Inbox/Marketplace recovery archives are outside the medication/auth migration and cannot be deleted wholesale without risking other residents' drafts. Review their account-specific cleanup before claiming comprehensive local-data deletion.
