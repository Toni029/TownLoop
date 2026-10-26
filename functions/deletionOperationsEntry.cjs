// Prepared non-worker deployment surface. No deletion, Storage or scheduler imports.
if(process.env.TOWNLOOP_FIRESTORE_DATABASE_ID&&process.env.TOWNLOOP_FIRESTORE_DATABASE_ID!=='(default)')throw Error('Operations control plane requires the default database.');
require('firebase-admin/app').initializeApp();
Object.assign(exports,require('./accountDeletionOperations.cjs'));
const proof=require('./cleanupProof.cjs');
exports.registerAccountCleanupDevice=proof.registerAccountCleanupDevice;
exports.checkAccountCleanupProof=proof.checkAccountCleanupProof;
