/** Administrative operator tool, never shipped in either client. No media/token output. */
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2),value=f=>args[args.indexOf(f)+1];
const project='cc-livingcommunity-app',bucket=project+'.firebasestorage.app';
const token=process.env.TOWNLOOP_METADATA_ACCESS_TOKEN;
if(!token||!args.includes('--quarantine-plan'))throw Error('Existing administrative OAuth session and original quarantine plan required');
const hash=x=>createHash('sha256').update(x).digest('hex');
const original=JSON.parse(fs.readFileSync(value('--quarantine-plan'),'utf8'));
if(hash(JSON.stringify(original.payload))!==original.digest||original.payload.project!==project||original.payload.bucket!==bucket||original.payload.held.length!==6)throw Error('Invalid original quarantine plan');
const manifest=JSON.parse(fs.readFileSync(new URL('./quarantine-manifest.json',import.meta.url)));
if(original.digest!==manifest.planDigest)throw Error('Quarantine plan differs from owner-approved manifest');
const allowed=new Set(original.payload.held.map(x=>x.path));
async function call(url,body){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('Administrative operation denied/failed: HTTP '+r.status);return r.json();}
// Cloud IAM, not application role/UI, restricts this operational recovery channel.
const perms=await call(`https://storage.googleapis.com/storage/v1/b/${bucket}/iam/testPermissions?permissions=storage.buckets.getIamPolicy&permissions=storage.buckets.update`);
if(!['storage.buckets.getIamPolicy','storage.buckets.update'].every(p=>perms.permissions?.includes(p)))throw Error('Storage administrator permissions required');
const operation=randomUUID();
async function audit(action,extra={}){await call('https://logging.googleapis.com/v2/entries:write',{logName:`projects/${project}/logs/townloop-storage-recovery`,resource:{type:'global',labels:{project_id:project}},entries:[{severity:'NOTICE',jsonPayload:{operation,action,...extra}}]});}
if(args.includes('--review')){
 await audit('quarantine_metadata_review_requested',{count:allowed.size});
 let unlinked=0,linked=0;
 for(const path of allowed){const r=await call(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}?fields=metadata(securityVersion,recordId,collection)`);r.metadata?.securityVersion==='1'?linked++:unlinked++;}
 await audit('quarantine_metadata_review_completed',{unlinked,linked});console.log(JSON.stringify({unlinked,linked,mediaDownloaded:0}));
}else if(args.includes('--restore')&&args.includes('--verified-plan')&&args.includes('--approve')){
 const plan=JSON.parse(fs.readFileSync(value('--verified-plan'),'utf8'));
 if(plan.digest!==value('--approve')||hash(JSON.stringify(plan.payload))!==plan.digest||plan.payload.project!==project||plan.payload.bucket!==bucket||!plan.payload.ready.length||plan.payload.ready.some(x=>!allowed.has(x.path)))throw Error('Explicitly approved, verified quarantine-only restoration plan required');
 // Existing executor rereads exact parent references and generation/metageneration;
 // a caller-supplied parent ID alone can never authorize recovery.
 await audit('verified_link_restoration_requested',{planDigest:plan.digest,objects:plan.payload.ready.map(x=>hash(x.path))});
 const r=spawnSync(process.execPath,[new URL('./apply-backfill.mjs',import.meta.url).pathname,value('--verified-plan'),'--apply','--approve',plan.digest,'--approved-partial',...(args.includes('--approved-embedded-reference-extraction')?['--approved-embedded-reference-extraction']:[])],{encoding:'utf8',env:process.env});
 await audit(r.status===0?'verified_link_restoration_completed':'verified_link_restoration_stopped',{planDigest:plan.digest,requiresReconciliation:r.status!==0});
 if(r.status!==0)throw Error('Recovery stopped; reconcile metadata before retrying');
 console.log('Verified linkage restored; no file bytes or download tokens changed.');
}else throw Error('Use --review, or --restore --verified-plan FILE --approve DIGEST after ownership verification');
