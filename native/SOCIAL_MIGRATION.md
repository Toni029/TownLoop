# Native Social review checkpoint

The native Social tab follows the unchanged CommunityScreen, DiscussionFeed, Marketplace, CreatePostModal, PostDetailModal, MessageSellerModal and MarketplaceChatModal on main a6567cd. It uses React Native views and Expo device APIs; no website or WebView is embedded. Four-tab order, authentication and approval architecture remain intact. Full-app visual polish is outside this phase.

## Migrated

- Community heading, counted Discussion Feed and Buy / Sell / Free selectors, TownLoop post/listing cards, author/avatar/publication metadata, category, prices, availability, creator/moderator trash controls, inline comments and detail dialogs. Layout screenshots were compared with the actual web components at phone width; roles and layouts were checked at 320/390/768 px.
- Live discussion posts, likes and comments; new post and new listing forms; price formatting; photo/video attachment picking and photo camera capture; progress, validation, error/retry and acknowledged success. Forms retain the mid-size/full-screen transition and staggered content opening. Publication ids and comment ids survive retries; submission locks prevent repeated taps.
- Native detail reading, all attachments, native share sheet, image zoom/pan/pinch/double tap and video playback controls. Errors stay inside the active dialog; media opens independently and returns to its detail. Safe areas, keyboard handling, screen-reader labels and enlarged touch areas are used.
- Marketplace seller actions: mark sold/available, delete with confirmation, seller inquiries with optional contact signature, sold-state protection. Resident/admin/VIP/crew visibility follows shared permissions. Ownership uses stable author uid, so same-name neighbors cannot acquire each other's controls.
- Existing marketplace inbox: unread badge, searching, buyer/seller conversation details, replies/read state, view listing, leave/delete conversation, system messages and closed conversation behavior. Message ids persist on retry; drafts clear on conversation changes. This is marketplace messaging within Social, not a migration of unrelated general chat or notifications.
- Firebase actions use fresh approved profiles, transactions and existing document fields. Concurrent comments/messages preserve earlier records. Own local reaction membership uses resident-isolated AsyncStorage; public totals remain in Firestore. Local save errors are visible and retry storage only, without repeating the acknowledged reaction.
- Collection subscriptions detach on unmount/account switch and ignore late callbacks. Upload/auth observers are removed after completion/failure and uploads cancel when the authenticated account changes. Expo video players and playback listeners dispose on unmount.

## Firebase model retained

| Path | Existing use |
| --- | --- |
| `users/{uid}` and `users` | Approval, roles, author/comment avatars; existing user fields |
| `discussion_feed/{id}` | Posts, `likes` count, `comments` array, `userId`, media and createdAt |
| `marketplace_posts/{id}` | Listing metadata, prices, comments, `sold`/`claimed`, author and media |
| `marketplace_chats/mkt_{itemId}_{buyerUid}` | Existing buyer/seller identities, participantIds, message array, unread/leave flags, updatedAt |
| Storage `feed/`, `marketplace/` | Existing attachment folders and upload metadata, 25 MB file limit |

All Firestore access uses the existing `(default)` database. No collection, schema, rule deployment or production test records were introduced. Marketplace chat rules in the reference currently allow unrestricted reads/writes; native screens/actions filter and validate participants, but that client guard does not repair server access control. A separate reviewed backend permission change is required before claiming server-enforced chat privacy. This migration does not widen or deploy those rules.

## Native equivalents and practical differences

- Browser file inputs, localStorage, window events and video elements become Expo picking/camera/file bytes, AsyncStorage, React state and Expo Video. Device video controls, camera/library and share sheet follow Android/iOS behavior. Gallery supports existing images/videos; camera capture is photos.
- The reference saves only its first selected attachment; native saves all selected attachments using the already-supported `media` field plus the legacy first `mediaUrl`. There is no new attachment schema.
- Shared avatar resolution uses uid (or exact email when uid is absent), rather than matching an unrelated resident's display name. Deletion/availability require stored uid, matching existing backend ownership rules.
- The reference share button displays a copied state without an actual share operation; native invokes the device's real share sheet with the item text.
- Translucent surfaces, font rasterization, shadows and modal gestures vary by platform. No full-app polishing was started. The web drag-to-dismiss gesture is represented by accessible close and platform back controls; the native height/opening transitions preserve the intent.
- Likes remain device-local membership as in the existing model, rather than a cross-device per-user reaction collection. Firebase rules allow updates to totals; exactly-once totals after an ambiguous network acknowledgement cannot be guaranteed without a backend/schema change. Rapid taps are guarded and acknowledged local-save retries do not repeat the remote write.

## Validation and acceptance

TypeScript, lint and 33 native tests passed, including Home's complete recurrence/reminder tests and News upload/removal/RSVP model tests. Expo dependency compatibility and all 21 Expo Doctor checks passed. Android and iOS JavaScript bundle exports passed. Actual native action modules passed 30 local Firestore emulator checks (13 Work Orders, 17 Social) against the unchanged rules. Forty isolated Social layout/role/form/comments/inbox/empty-state assertions passed; Work Orders previously passed 28. Screenshots use disposable fixtures, never production data.

The reproducible Firebase harness is `verification/tabs-emulator.mjs`; provide a local tools package with Firebase SDK, TypeScript, @firebase/rules-unit-testing and firebase-tools, start a localhost Firestore emulator, and pass that tools package path. The harness refuses remote emulator hosts. `--social` includes both tab suites. `verification/news-emulator.mjs` independently covers the prior News actions.

Physical-device acceptance is still required: existing resident/admin/crew accounts and actual deployed Firebase permissions; live multi-device updates; real Storage uploads; photo/video selection, cancellation/denial, interrupted uploads; image gestures and video controls; native keyboard behavior and share sheet; Android back and iOS modal presentation; large text, TalkBack and VoiceOver; offline/reconnect, repeated taps and sign-out during uploads. Layout fixtures and bundle exports are not signed APK/IPA builds or authenticated production acceptance.

No Social functionality was deliberately dropped. Work Orders cloud Spanish translation still uses the reference's local fallback until authenticated `/api/translate` is deployed. Existing News Gemini analysis remains deferred to a secure backend, and its previously documented resident RSVP rule mismatch remains unresolved; neither was altered in this phase.
