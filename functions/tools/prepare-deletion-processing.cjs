// Package only the approved-account pipeline. General orphan cleanup stays absent.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'..'),target=path.resolve(source,'../.release/deletion-processing');
// Explicit local opt-in: existing releases keep their reviewed rules pin. The
// native-only rollout config selects its new pin without changing worker behavior.
const rulesManifest=require('./deletion-rules-manifest.cjs').selectedRulesManifest(process.argv.slice(2));
const files=['accountDeletionAutomation.cjs','accountDeletionPreflight.cjs','accountDeletionRunner.cjs','accountDeletionMedia.cjs','accountDeletionLateMedia.cjs','accountDeletionScoped.cjs','accountDeletionV2.cjs','accountDeletionInventory.cjs','accountDeletionScope.cjs','accountDeletionPolicy.cjs','accountDeletionRetention.cjs','mediaCleanupPolicy.cjs','deletionMediaReferences.cjs','deletionMediaProvenance.json','storageWebAccessPolicy.cjs','package.json','package-lock.json'];
fs.mkdirSync(target,{recursive:true});for(const file of files)fs.copyFileSync(path.join(source,file),path.join(target,file));
fs.copyFileSync(path.join(source,'deletionProcessingEntry.cjs'),path.join(target,'index.cjs'));
fs.copyFileSync(rulesManifest,path.join(target,'deletionScopeRules.json'));
if(!fs.existsSync(path.join(target,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(target,'node_modules'),'dir');
console.log('Prepared one isolated approved-account worker. Activation requires explicit environment flags and verified server policy.');
