// NOT imported by index.cjs or Stage A. Separate deployment/activation approval required.
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {scanRetentionPage,cleanupRetentionPage}=require('./inbox-retention-monitor.cjs');
const options={schedule:'every 60 minutes',region:'us-central1',timeZone:'Etc/UTC',timeoutSeconds:540,maxInstances:1};
exports.monitorInboxRetention=onSchedule(options,async()=>{
 if(process.env.INBOX_RETENTION_MONITOR_ENABLED!=='true')return;
 await scanRetentionPage(getFirestore('(default)'),{enabled:true});
});
exports.cleanupExpiredInboxConversations=onSchedule(options,async()=>{
 if(process.env.INBOX_RETENTION_CLEANUP_ENABLED!=='true')return;
 await cleanupRetentionPage(getFirestore('(default)'),getStorage().bucket(),{enabled:true});
});
