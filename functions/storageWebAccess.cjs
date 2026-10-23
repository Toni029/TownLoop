const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { WEB_DATABASE, syncWebMembership } = require('./storageWebAccessPolicy.cjs');
// PREPARED ONLY. No named-database/profile/Hosting mutation; reads role/approval fields only.
exports.syncHostedStorageMembership=onDocumentWritten({database:WEB_DATABASE,document:'users/{uid}',region:'us-central1',retry:true,maxInstances:2,timeoutSeconds:60},event=>syncWebMembership(getFirestore('(default)'),getFirestore(WEB_DATABASE),event.params.uid));
