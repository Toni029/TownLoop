// Scoped non-destructive release. No request handlers or deletion/cleanup engine.
require('firebase-admin/app').initializeApp();
Object.assign(exports,require('./accountDeletionMonitor.cjs'));
