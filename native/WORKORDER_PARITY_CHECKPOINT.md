# Work-order picker and numbering checkpoint

The native request form now mirrors the original WorkOrderModal category dropdown: rounded trigger, emoji tiles, category descriptions, emerald selected row/checkmark, floating scrollable 256px panel, and 180ms fade/translate/scale transitions. The original browser cannot be inspected automatically because of its saved permission block; comparison was against source.

Ticket text bundles the licensed DotGothic16 font. The original CSS labels this style “Dotrice Bold” but supplies no Dotrice font, and uses DotGothic16 as its first available fallback. Long ticket numbers shrink to fit rather than truncate.

Both clients allocate new ticket numbers through a Firestore counter transaction. The sequence starts at WO-10000 to avoid the original random four-digit range. Existing tickets retain their numbers. Native retries reuse their document ID without advancing the counter. Transactional submissions require connectivity.

Residents query and can read only their own tickets. Crew, admin and VIP retain their existing full access. The rules prevent changing ticket numbers, codes or ownership after creation. Counter increments require an atomic new ticket owned by the caller, and cannot be made independently.

Validation: native and original TypeScript checks, focused native ESLint, six unit/JSX checks, Expo web export, and disposable Firestore emulator tests for concurrent numbering, retries, resident isolation, crew listing, tamper rejection and normal crew updates. No production data was changed.

Live Firestore rules successfully compiled and deployed to cc-livingcommunity-app on 2026-10-11 after the user completed Firebase CLI authentication. Sequential submissions and server-enforced resident isolation are now enabled. No production tickets were created for verification.
