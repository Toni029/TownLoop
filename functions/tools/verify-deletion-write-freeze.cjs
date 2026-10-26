// Read-only deployment gate. No Firestore data, rules deployment or credential changes.
const fs=require('node:fs'),{createHash}=require('node:crypto');
const {DATABASES,BLOCKED_NAMED_RULES}=require('../accountDeletionScope.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
(async()=>{try{
 const args=process.argv.slice(2),paths=['--reviewed-default','--reviewed-website','--reviewed-storage'].map(flag=>{const n=args.indexOf(flag);if(n<0||!args[n+1])throw Error('reviewed_candidates_required');return args[n+1];});
 const auth=require(process.env.TOWNLOOP_FIREBASE_AUTH_MODULE),account=auth.getGlobalDefaultAccount();if(!account)throw Error('existing_auth_required');
 const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const get=async url=>{const r=await fetch(url,{headers:{Authorization:'Bearer '+token.access_token}});if(!r.ok)throw Error('read_only_rules_check_failed');return r.json();};
 const result={project:'cc-livingcommunity-app',checkedAt:new Date().toISOString(),ready:true,scopeRuleHashes:{}};
 for(let i=0;i<DATABASES.length;i++) {
  const release=await get(`https://firebaserules.googleapis.com/v1/projects/cc-livingcommunity-app/releases/${i?'cloud.firestore/'+DATABASES[i]:'cloud.firestore'}`),rules=await get(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  const source=rules.source.files.map(f=>f.content).join('\n'),digest=hash(source);
  result.scopeRuleHashes[DATABASES[i]]=digest;
  if(digest!==hash(fs.readFileSync(paths[i]))||digest===BLOCKED_NAMED_RULES||/allow\s+[^;]*write[^;]*:\s*if\s+true\s*;/.test(source))result.ready=false;
 }
 const storageRelease=await get('https://firebaserules.googleapis.com/v1/projects/cc-livingcommunity-app/releases/firebase.storage/cc-livingcommunity-app.firebasestorage.app'),storageRules=await get('https://firebaserules.googleapis.com/v1/'+storageRelease.rulesetName);
 result.storageRulesSha256=hash(storageRules.source.files.map(f=>f.content).join('\n'));
 if(result.storageRulesSha256!==hash(fs.readFileSync(paths[2]))||result.storageRulesSha256!==require('../deletionMediaProvenance.json').storageRulesSha256)result.ready=false;
 console.log(JSON.stringify(result));if(!result.ready)process.exitCode=2;
 }catch{console.log(JSON.stringify({ready:false,reason:'read_only_gate_unavailable_or_candidates_missing'}));process.exitCode=1;}})();
