# Native decoder compatibility security patch

This is upstream `decode-uri-component` **0.5.1**, verified against the npm
archive's SHA-512 (recorded in `upstream.json`), with only its ESM default-function
export changed to a callable CommonJS assignment. MIT license is preserved.
No decoding algorithm is rewritten. The upstream release fixes
[GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).

The current Expo Router uses `query-string@7.1.3`, which calls the required module
as a function. Forcing upstream ESM 0.5.1 into that caller breaks normal links.
`native/metro.config.js` substitutes this compatible upstream implementation for
all bare decoder imports (and the legacy index subpath) on Android/iOS, while
preserving the prior Metro resolver for every other package. The old package
remains in the dependency lock for tool compatibility; native runtime bundles
must use this replacement. A lockfile scanner finding alone does not verify the
bundled implementation. Do not delete this override merely to hide an advisory.

Tests exercise the actual current query-string caller, Metro resolution, normal
Inbox IDs, Unicode, plus/array handling, malformed escapes, upstream byte identity
and a bounded isolated large malformed-input case. No live app/backend data is
used. A native JS export is checked for inclusion of this module and absence of
the old recursive decoder. Physical Android/iPhone deep-link, notification-tap
and Google callback tests remain release gates. No native dependency changes.

Remove this compatibility patch only after a supported Expo Router/query-string
upgrade provides the fixed decoder with a compatible import contract and the
same regression tests pass against the produced bundle. Never patch unrelated
startup/media dependencies as part of this fix.
