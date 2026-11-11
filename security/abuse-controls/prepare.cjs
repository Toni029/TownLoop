/** Local-only scoped packaging. No deployment, credentials, tasks or cloud calls. */
const fs=require('node:fs'),path=require('node:path');
function prepare(){
 const root=path.resolve(__dirname,'../..'),out=path.join(root,'.release/request-controls');fs.mkdirSync(out,{recursive:true});
 for(const name of fs.readdirSync(path.join(root,'functions'))){if((name.endsWith('.cjs')&&!name.endsWith('.test.cjs'))||['package.json','package-lock.json'].includes(name))fs.copyFileSync(path.join(root,'functions',name),path.join(out,name));}
 fs.writeFileSync(path.join(out,'index.cjs'),`const {getApps,initializeApp}=require('firebase-admin/app');if(!getApps().length)initializeApp();\nexports.manageInboxConversation=require('./inbox-groups-entry.cjs').manageInboxConversation;\nexports.translateWorkOrder=require('./translation.cjs').translateWorkOrder;\nexports.reviewAccountDeletionRequest=require('./accountDeletionReview.cjs').reviewAccountDeletionRequest;\nObject.assign(exports,require('./media-upload-entry.cjs'),require('./newsletter-upload-entry.cjs'),require('./databaseCleanupQuotaGatewayEntry.cjs'));\n`);
 // Existing functions must keep their deployed codebase labels; never guess ownership.
 if(fs.existsSync(path.join(out,'firebase.json')))fs.unlinkSync(path.join(out,'firebase.json'));
 if(!fs.existsSync(path.join(out,'node_modules')))fs.symlinkSync(path.join(root,'functions/node_modules'),path.join(out,'node_modules'),'dir');
 const privateOut=path.join(root,'.release/request-inventory-readonly');fs.mkdirSync(privateOut,{recursive:true});
 for(const name of ['package.json','package-lock.json','databaseCleanupReadOnly.cjs'])fs.copyFileSync(path.join(root,'functions',name),path.join(privateOut,name));
 const original=fs.readFileSync(path.join(root,'functions/databaseCleanupReadOnlyEntry.cjs'),'utf8');
 fs.writeFileSync(path.join(privateOut,'index.cjs'),require('../../functions/databaseCleanupQuotaGateway.cjs').protectedReadOnlySource(original));
 if(!fs.existsSync(path.join(privateOut,'node_modules')))fs.symlinkSync(path.join(root,'functions/node_modules'),path.join(privateOut,'node_modules'),'dir');
 console.log('Prepared scoped request controls; no workers/schedules exported, nothing deployed.');return out;
}
module.exports={prepare};if(require.main===module)prepare();
