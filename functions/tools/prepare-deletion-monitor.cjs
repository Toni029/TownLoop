// Local-only packaging; deployment still requires separate owner approval.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'..'),target=path.resolve(source,'../.release/deletion-monitor');
const files=['accountDeletionMonitor.cjs','accountDeletionAdminAlerts.cjs','deletionAlertExpiry.cjs','cleanupProof.cjs','accountDeletionPolicy.cjs','accountDeletionRetention.cjs','package.json','package-lock.json'];
fs.mkdirSync(target,{recursive:true});
for(const file of fs.readdirSync(target))if(![...files,'index.cjs','node_modules'].includes(file))throw Error('Unexpected monitor release file');
for(const file of files)fs.copyFileSync(path.join(source,file),path.join(target,file));
fs.copyFileSync(path.join(source,'deletionMonitorEntry.cjs'),path.join(target,'index.cjs'));
if(!fs.existsSync(path.join(target,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(target,'node_modules'),'dir');
console.log('Prepared disabled-by-default monitor source only; no deployment.');
