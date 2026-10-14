// Serve the worker and auxiliary assets from the same pinned PDF.js package.
const { mkdirSync, cpSync } = require('node:fs');
const path = require('node:path');
const source = path.dirname(require.resolve('pdfjs-dist/package.json'));
const target = path.resolve(__dirname, '../public/pdfjs');
mkdirSync(target, { recursive: true });
cpSync(path.join(source, 'build/pdf.worker.min.mjs'), path.join(target, 'pdf.worker.min.mjs'));
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(path.join(source, folder), path.join(target, folder), { recursive: true });
