/** Prepared only. Explicit approval + complete linkage receipt + deployed rules/bridge required. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {WEB_DATABASE,POLICY_PATH,webMembership}=require('../../functions/storageWebAccessPolicy.cjs');
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
if(!args.includes('--activate')||!args.includes('--approve')||!args.includes('--receipt'))throw Error('Explicit --activate --approve PLAN_SHA256 --receipt FILE required');
const receipt=JSON.parse(fs.readFileSync(value('--receipt'),'utf8'));
if(receipt.planDigest!==value('--approve')||receipt.stopped||receipt.project!=='cc-livingcommunity-app'||receipt.bucket!=='cc-livingcommunity-app.firebasestorage.app')throw Error('Complete approved linkage receipt required; held objects block activation');
// Explicit preservation-first exception: only the six approved, unchanged legacy objects.
let quarantine=[];
if(receipt.held){
 if(!args.includes('--approved-quarantine')||!args.includes('--quarantine-plan'))throw Error('Unresolved objects require explicit quarantine approval');
 const plan=JSON.parse(fs.readFileSync(value('--quarantine-plan'),'utf8'));
 if(plan.digest!==receipt.planDigest||createHash('sha256').update(JSON.stringify(plan.payload)).digest('hex')!==plan.digest||plan.payload.held.length!==6||receipt.held!==6||receipt.applied+receipt.alreadyApplied!==4)throw Error('Quarantine scope differs from approved four linked / six held');
 if(plan.digest!==JSON.parse(fs.readFileSync(new URL('./quarantine-manifest.json',import.meta.url))).planDigest)throw Error('Quarantine plan differs from owner-approved manifest');
 quarantine=plan.payload.held.map(x=>x.path);
 if(new Set(quarantine).size!==6||quarantine.some(x=>!/^work_orders\/[^/]+$/.test(x)))throw Error('Invalid quarantine scope');
}
const token=process.env.TOWNLOOP_METADATA_ACCESS_TOKEN;if(!token)throw Error('Existing authorized OAuth token required in environment');
const project=receipt.project,base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
async function call(url,body,allowMissing=false){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(allowMissing&&r.status===404)return null;if(!r.ok)throw Error('Activation stopped: HTTP '+r.status);return r.json();}
const candidate=fs.readFileSync(new URL('./storage.compatible.rules',import.meta.url),'utf8'),hash=createHash('sha256').update(candidate).digest('hex');
const release=await call(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/firebase.storage/${receipt.bucket}`),rules=await call('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
if(rules.source.files.find(f=>f.name.endsWith('.rules'))?.content!==candidate)throw Error('Reviewed Storage candidate is not deployed');
const namedRelease=await call(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore/${WEB_DATABASE}`),namedRules=await call('https://firebaserules.googleapis.com/v1/'+namedRelease.rulesetName);
const sourceHash=createHash('sha256').update(namedRules.source.files.find(f=>f.name.endsWith('.rules')).content).digest('hex');
if(sourceHash!==JSON.parse(fs.readFileSync(new URL('./source-authorization.json',import.meta.url))).namedRulesSha256)throw Error('Named authorization rules changed; review required');
const fn=await call(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions/syncHostedStorageMembership`);
if(fn.state!=='ACTIVE'||fn.buildConfig?.entryPoint!=='syncHostedStorageMembership')throw Error('Membership bridge must be healthy first');
for(const object of quarantine){
 const q='?fields=generation,metadata(securityVersion,recordId,collection)';
 const m=await call(`https://storage.googleapis.com/storage/v1/b/${receipt.bucket}/o/${encodeURIComponent(object)}${q}`);
 if(m.metadata?.securityVersion==='1'||m.metadata?.recordId||m.metadata?.collection)throw Error('Quarantined object changed; review before cutover');
}
const current=await call(base+'/'+POLICY_PATH,undefined,true),fields=current?.fields||{};
if(fields.legacyUploadsAfter?.timestampValue){if(fields.storageRulesSha256?.stringValue!==hash)throw Error('Existing cutover belongs to a different candidate');console.log('Already active; cutover preserved.');process.exit(0);}
const rows=await call(`https://firestore.googleapis.com/v1/projects/${project}/databases/${WEB_DATABASE}/documents:runQuery`,{structuredQuery:{from:[{collectionId:'users'}],select:{fields:['role','approved','deletionPending'].map(fieldPath=>({fieldPath}))}}});
const readTime=rows.at(-1)?.readTime;if(!readTime)throw Error('Missing source read timestamp');
const members={...(fields.members?.mapValue?.fields||{})},present=new Set();
for(const r of rows){if(!r.document)continue;const uid=r.document.name.split('/').pop(),f=r.document.fields||{},p=webMembership({role:f.role?.stringValue,approved:f.approved?.booleanValue,deletionPending:f.deletionPending?.booleanValue});present.add(uid);members[uid]={mapValue:{fields:{approved:{booleanValue:p.approved},role:{stringValue:p.role},observedAt:{timestampValue:r.readTime||readTime}}}};}
for(const uid of Object.keys(members))if(!present.has(uid))members[uid]={mapValue:{fields:{approved:{booleanValue:false},role:{stringValue:''},observedAt:{timestampValue:readTime}}}};
await call(base+':commit',{writes:[{update:{name:`projects/${project}/databases/(default)/documents/${POLICY_PATH}`,fields:{members:{mapValue:{fields:members}},storageRulesSha256:{stringValue:hash}}},updateMask:{fieldPaths:['members','storageRulesSha256']},currentDocument:current?{updateTime:current.updateTime}:{exists:false},updateTransforms:[{fieldPath:'legacyUploadsAfter',setToServerValue:'REQUEST_TIME'}]}]});
console.log('Web compatibility activated after strict rules; no Auth, resident, file or token changes.');
