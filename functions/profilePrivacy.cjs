const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { syncDirectoryProfile } = require('./profilePrivacyPolicy.cjs');
// Must match both release clients; named databases need an explicitly matching deployment.
const database = process.env.TOWNLOOP_FIRESTORE_DATABASE_ID || '(default)';
exports.syncResidentDirectory = onDocumentWritten({
  document: 'users/{uid}', database, region: 'us-central1', maxInstances: 4,
  timeoutSeconds: 60, retry: true,
}, event => syncDirectoryProfile(getFirestore(database), event.params.uid));
