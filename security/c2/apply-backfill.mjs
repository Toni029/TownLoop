/** Explicit-approval metadata-only executor. Reads no object contents or comment bodies. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { applyLink } from './linkage.mjs';
import { normalizeRecord } from './prepare-plan.mjs';
const args=process.argv.slice(2),input=args[0],approve=args[args.indexOf('--approve')+1];
if(!input||!args.includes('--apply')||!args.includes('--approve'))throw Error('Explicit --apply --approve PLAN_SHA256 required');
const {payload,digest}=JSON.parse(fs.readFileSync(input,'utf8'));
if(approve!==digest||createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==digest)throw Error('Unapproved or modified plan');
if(payload.project!=='cc-livingcommunity-app'||payload.bucket!=='cc-livingcommunity-app.firebasestorage.app')throw Error('Wrong target');
if(payload.held.length&&!args.includes('--approved-partial'))throw Error('Held objects: explicit partial-plan approval required');
const token=process.env.TOWNLOOP_METADATA_ACCESS_TOKEN;if(!token)throw Error('Existing authorized OAuth token required in environment (never print it)');
async function call(url,options={}){const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});if(!r.ok)throw Error(`Metadata operation HTTP ${r.status}; stop and replan`);return r.json();}
const objectUrl=p=>`https://storage.googleapis.com/storage/v1/b/${payload.bucket}/o/${encodeURIComponent(p)}`;
const api={bucket:payload.bucket,
 readParent:async parent=>{
  if(parent.database!=='(default)'||!/^[A-Za-z0-9_-]{1,128}$/.test(parent.id))throw Error('Invalid parent');
  const embedded=parent.referenceScope==='embedded';if(embedded&&!args.includes('--approved-embedded-reference-extraction'))throw Error('Embedded reference read needs separate approval');
  const q=new URLSearchParams();for(const f of ['userId','photos','photoUrl','latestResolutionPhoto','storageDraft',...(embedded?['comments']:[])])q.append('mask.fieldPaths',f);
  const r=await call(`https://firestore.googleapis.com/v1/projects/${payload.project}/databases/(default)/documents/work_orders/${parent.id}?${q}`);
  return normalizeRecord({...r,database:'(default)'},payload.bucket,{includeEmbedded:embedded});
 },
 readObject:async p=>{if(!/^work_orders\/[^/]+$/.test(p))throw Error('Wrong object scope');return call(objectUrl(p)+'?fields=name,generation,metageneration,metadata');},
 // Existing custom metadata, including tokens, stays in memory only and is copied unchanged.
 patchMetadata:async(p,metadata,c)=>call(objectUrl(p)+'?'+new URLSearchParams({ifGenerationMatch:c.generation,ifMetagenerationMatch:c.metageneration,fields:'name,generation,metageneration'}),{method:'PATCH',body:JSON.stringify({metadata})}),
};
let applied=0,alreadyApplied=0;
try{for(const item of payload.ready){const result=await applyLink(item,api);result==='applied'?applied++:alreadyApplied++;}}
catch(e){console.error(JSON.stringify({applied,alreadyApplied,stopped:true,requiresReconciliation:!!e.requiresReconciliation,error:e.message}));process.exit(1);}
const receipt={project:payload.project,bucket:payload.bucket,planDigest:digest,applied,alreadyApplied,held:payload.held.length,filesDeleted:0,bytesReplaced:0,tokensRevoked:0};
if(args.includes('--receipt')){const file=args[args.indexOf('--receipt')+1];fs.writeFileSync(file,JSON.stringify(receipt),{mode:0o600});fs.chmodSync(file,0o600);}
console.log(JSON.stringify(receipt));
