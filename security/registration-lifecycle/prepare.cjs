// Offline packaging only. Never provisions, deploys or activates deletion.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function prepare(){const out=path.join(root,'.release/registration-lifecycle');fs.mkdirSync(out,{recursive:true});for(const name of ['package.json','package-lock.json','registrationLifecycle.cjs','registration-lifecycle-entry.cjs','referenceWriteBarrier.cjs'])fs.copyFileSync(path.join(root,'functions',name),path.join(out,name));fs.writeFileSync(path.join(out,'index.cjs'),"require('firebase-admin/app').initializeApp();\nObject.assign(exports,require('./registration-lifecycle-entry.cjs'));\n");fs.writeFileSync(path.join(out,'.env'),'TOWNLOOP_REGISTRATION_API_ENABLED=false\nTOWNLOOP_REGISTRATION_WORKER_ENABLED=false\n');return out;}
module.exports={prepare};if(require.main===module)console.log('Prepared local disabled package: '+prepare());
