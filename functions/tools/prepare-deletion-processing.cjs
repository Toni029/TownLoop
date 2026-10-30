// Package only the approved-account pipeline. General orphan cleanup stays absent.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'..'),target=path.resolve(source,'../.release/deletion-processing');
const files=['accountDeletionAutomation.cjs','accountDeletionPreflight.cjs','accountDeletionRunner.cjs','accountDeletionMedia.cjs','accountDeletionScoped.cjs','accountDeletionV2.cjs','accountDeletionInventory.cjs','accountDeletionScope.cjs','accountDeletionPolicy.cjs','accountDeletionRetention.cjs','mediaCleanupPolicy.cjs','deletionMediaReferences.cjs','deletionMediaProvenance.json','storageWebAccessPolicy.cjs','package.json','package-lock.json'];
fs.mkdirSync(target,{recursive:true});for(const file of files)fs.copyFileSync(path.join(source,file),path.join(target,file));
fs.copyFileSync(path.join(source,'deletionProcessingEntry.cjs'),path.join(target,'index.cjs'));
fs.copyFileSync(path.join(source,'../security/account-deletion/rules-manifest.json'),path.join(target,'deletionScopeRules.json'));
if(!fs.existsSync(path.join(target,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(target,'node_modules'),'dir');
console.log('Prepared one isolated approved-account worker. Activation requires explicit environment flags and verified server policy.');
