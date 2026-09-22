# App structure

`src/App.tsx` now coordinates the portal in 184 lines instead of 2,301.
The refactor preserves the existing behavior, rendered markup, styles, and animations.

## Where to edit

| Area | Files |
| --- | --- |
| Application layout and authentication views | `src/App.tsx` |
| Main screens | `src/screens/HomeScreen.tsx`, `NewsScreen.tsx`, `WorkOrdersScreen.tsx`, `CommunityScreen.tsx` |
| Header and navigation | `src/components/layout/` |
| Checklist and calendar dialogs | `src/components/tasks/` |
| Maintenance request dialog | `src/components/workorders/` |
| Discussion feed and marketplace | `src/components/community/` |
| Modal coordination | `src/components/PortalModals.tsx` |
| Feature state and event handlers | `src/hooks/` |
| Existing initial data | `src/data/` |

All feature hooks are called unconditionally by `App`. This keeps their state alive
when residents switch tabs or authentication views. Screen components receive state
and handlers through typed props; extracting them does not add DOM wrapper elements.
Initial-data factories return fresh arrays for each app instance.

Firebase configuration, authentication services, Firestore rules, the server,
dependencies, existing standalone components, and `src/index.css` were not changed.
This is an organizational refactor; existing functional limitations are not addressed.

When moving the refactor into Google AI Studio, include the entire updated `src`
directory, including the new subdirectories. Copying only `App.tsx` will leave imports
unresolved. Preserve the destination project's environment variables and Firebase setup.

## Verification

- TypeScript checking and the frontend/server production builds pass.
- An isolated comparison harness passed 36 before/after scenarios, including state
  retention, dialogs, theme changes, community actions, and authentication views.
- All four main screens produced identical rendered HTML in browser comparisons.
- The compiled CSS was byte-for-byte identical to the original build.
- Test authentication was isolated, and preview data connections were blocked.
  No live Firebase records were modified or used for write tests.

The existing large JavaScript bundle warning remains. Reducing source-file size does
not by itself reduce download size or prove the cause of an AI Studio crash.
