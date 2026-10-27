// Generates an isolated local artifact only; never deploys or loads held workers.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.release/inbox-push'),source=path.join(out,'functions');
fs.mkdirSync(source,{recursive:true});
for(const file of ['inbox.cjs','inbox-policy.cjs','inbox-push.cjs','notification-events.cjs','package-lock.json'])fs.copyFileSync(path.join(root,'functions',file),path.join(source,file));
const pkg=require(path.join(root,'functions/package.json'));
fs.writeFileSync(path.join(source,'package.json'),JSON.stringify({...pkg,main:'index.cjs'},null,2));
fs.writeFileSync(path.join(source,'index.cjs'),"require('firebase-admin/app').initializeApp();\nObject.assign(exports,require('./inbox.cjs'));\n");
fs.writeFileSync(path.join(out,'firebase.json'),JSON.stringify({functions:[{source:'functions',codebase:'default',runtime:'nodejs22'}]},null,2));
console.log('Isolated Inbox-only artifact prepared. Sending defaults OFF. No deployment performed.');
