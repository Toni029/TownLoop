'use strict';
// LOCAL packaging only. This script never runs Firebase, cloud APIs, or deletion jobs.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.release/database-cleanup');
const {PINS}=require('../../functions/databaseCleanupSafety.cjs');
const source=fs.readFileSync(path.join(__dirname,'firestore.rules'));
if(createHash('sha256').update(source).digest('hex')!==PINS.defaultRulesSha256)throw Error('Cleanup candidate rules pin differs');
fs.mkdirSync(path.join(out,'functions'),{recursive:true});
for(const name of ['databaseCleanup.cjs','databaseCleanupEntry.cjs','databaseCleanupSafety.cjs','package-lock.json'])fs.copyFileSync(path.join(root,'functions',name),path.join(out,'functions',name));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'functions/package.json')));pkg.main='databaseCleanupEntry.cjs';delete pkg.scripts;
fs.writeFileSync(path.join(out,'functions/package.json'),JSON.stringify(pkg,null,2)+'\n');
fs.writeFileSync(path.join(out,'firestore.rules'),source);
fs.writeFileSync(path.join(out,'firebase.json'),JSON.stringify({functions:[{source:'functions',codebase:'database-cleanup',ignore:['node_modules','.env*','*.test.cjs']}],firestore:[{database:'(default)',rules:'firestore.rules'}]},null,2)+'\n');
fs.writeFileSync(path.join(out,'functions/.env.cc-livingcommunity-app'),'TOWNLOOP_DATABASE_CLEANUP_ENABLED=false\n');
fs.writeFileSync(path.join(out,'policy.UNAPPROVED.json'),JSON.stringify({...PINS,version:1,ownerApproved:false,storageMode:'hold-unproven-media',genericMediaCleanupDisabledAcknowledged:false},null,2)+'\n');
console.log('Prepared isolated, DISABLED local cleanup package. No deployment or activation performed.');
