# Browser newsletter support — 2026-10-14

Expo Web now selects PDFs, uses the existing staged Firestore publishing flow,
opens edition data as a temporary object URL, renders PDF.js pages inside the
existing reader, and downloads PDFs. Page navigation, zoom and fit width use the
existing toolbar. Offscreen page canvases are released to bound memory.

The 32 MB limit, PDF signature validation, manager authorization, edition-change
checks and atomic publication pointer remain in place. No live newsletter was
uploaded or replaced during development.

PDF.js is pinned in package-lock.json. `npm ci` runs the asset preparation script
to copy its matching worker, fonts, character maps and WASM into public/pdfjs.
The same preparation runs before npm start/web. Generated assets are ignored.

Validation: browser file adapter tests and existing News tests (10 checks),
TypeScript, focused lint, Expo web export, and local worker HTTP response.
Browser visual inspection remains unavailable due the saved browser permission
restriction. User verification still required: select a PDF, publish it, open it,
scroll/jump pages, zoom, download, close/reopen. Android/iOS retain their native
renderer and file adapters and still require device verification.
