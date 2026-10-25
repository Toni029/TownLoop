// Isolated release entry: no workers, triggers, Storage, or destructive engine.
if (process.env.TOWNLOOP_FIRESTORE_DATABASE_ID && process.env.TOWNLOOP_FIRESTORE_DATABASE_ID !== '(default)') {
  throw new Error('Deletion review release is restricted to the default database.');
}
require('firebase-admin/app').initializeApp();
Object.assign(exports, require('./accountDeletionReview.cjs'));
