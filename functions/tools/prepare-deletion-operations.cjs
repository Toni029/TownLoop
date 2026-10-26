// Local packaging only. Does not deploy or activate anything.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'..'),target=path.resolve(source,'../.release/deletion-operations');
const files=['accountDeletionOperations.cjs','cleanupProof.cjs','accountDeletionScope.cjs','accountDeletionPolicy.cjs','accountDeletionRetention.cjs','package.json','package-lock.json'];
fs.mkdirSync(target,{recursive:true});
for(const file of fs.readdirSync(target))if(![...files,'index.cjs','node_modules'].includes(file))throw Error('Unexpected operations artifact source');
for(const file of files)fs.copyFileSync(path.join(source,file),path.join(target,file));
fs.copyFileSync(path.join(source,'deletionOperationsEntry.cjs'),path.join(target,'index.cjs'));
if(!fs.existsSync(path.join(target,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(target,'node_modules'),'dir');
console.log('Prepared isolated operations callables; no workers or deployment.');
