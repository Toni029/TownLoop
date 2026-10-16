# Dock, ticket numbering, and OTA status — 2026-10-16

Recovery: `checkpoint/before-numbering-and-update-status-2026-10-16` (`a5c3ac3`).

## Changes

- News selection bubble follows measured tab bounds, with six pixels of clearance on each side. Other tabs retain their original dimensions and springs.
- Ticket digits use the existing Dotrice Bold asset, with increased text height, constrained width, centered alignment, and text-only vertical scaling. Stored historical numbers are unchanged.
- Web and native share an atomic four-digit allocator. Numbers range from 1000 through 9999, skip permanent historical reservations, and never wrap or reuse deleted-ticket numbers. Exhaustion and failed allocation preserve the submission draft.
- Existing data has no community field on work orders: allocation stays database-wide for Cecil Pines. Do not introduce per-device or per-user counters.
- OTA feedback uses installed expo-updates state and real download progress when available. Pending updates downloaded before React starts are recognized. Restart requires a user action and confirmation. Applied updates use a dismissible acknowledgement instead of technical dialogs; no automatic restart was added.
- Metro resolves Firebase for shared source from the native application's dependencies. No native dependencies, package identity, runtime configuration, or update channels changed.

## Approved Firebase deployment

Deployed only Firestore rules to `cc-livingcommunity-app`. The audited migration then atomically created `counters/work_orders_four_digit` (lastNumber 999, ready true) and two historical reservations in `work_order_numbers`.

Read-back verification confirmed all four historical tickets and the old five-digit counter were unchanged. First available number at migration was 1000. Existing published five-digit clients remain compatible; they continue their old sequence until updated. Archived random-number clients cannot create unallocated tickets under the strengthened rules.

Reservations are permanent metadata, not duplicate work orders. Never delete reservations or reset the counter when rolling back. The recovery client can continue using the legacy five-digit allocator with these rules retained.

## Validation

- Native and web TypeScript passed; Expo lint passed; all 77 unit tests passed; Expo dependency compatibility passed.
- Firestore emulator passed concurrent submissions, historical-number skips, idempotent retry, forged allocation denial, resident isolation, crew visibility, legacy-client allocation, final number 9999, and safe exhaustion.
- Android JavaScript/assets export passed after correcting shared-module resolution. This is not an APK or physical-device test.
- Unit geometry checks cover all four tabs and multiple screen widths; typography checks include 1000, 1888, 8888, and 9999.
- Browser automation was denied by a saved browser permission. Native appearance and OTA banner behavior still require phone review. No production test tickets were created.

No GitHub push or EAS publication performed for this checkpoint. These changes use existing native modules and are intended for OTA delivery; confirm the target runtime fingerprint before an approved publication.
