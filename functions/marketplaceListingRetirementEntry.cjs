'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { retireListingPreviews } = require('./marketplaceListingRetirement.cjs');

if (!getApps().length) initializeApp();

// This deployment removes listing references from existing chats. Storage
// cleanup stays in its separate worker until shared-reference protection is ready.
exports.cleanupDeleted_marketplace_posts = onDocumentDeleted({
  region: 'us-central1',
  database: '(default)',
  document: 'marketplace_posts/{recordId}',
  timeoutSeconds: 300,
  maxInstances: 1,
  retry: true,
}, async event => {
  if (!event.data?.exists) return;
  await retireListingPreviews(getFirestore('(default)'), event.params.recordId);
});
