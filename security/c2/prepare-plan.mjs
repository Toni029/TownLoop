import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { planLinks, objectPath } from './linkage.mjs';
const decode=v=>v?.stringValue??v?.booleanValue;
export function normalizeRecord(r,bucket,{includeEmbedded=false}={}) {
 const f=r.fields||{};
 const embedded=[];
 if(includeEmbedded)for(const c of f.comments?.arrayValue?.values||[]){const x=c.mapValue?.fields||{};embedded.push(x.photoUrl?.stringValue,x.latestResolutionPhoto?.stringValue);for(const v of x.revisions?.arrayValue?.values||[])embedded.push(v.mapValue?.fields?.photoUrl?.stringValue);}
 const urls=[...embedded,f.photoUrl?.stringValue,f.latestResolutionPhoto?.stringValue,...(f.photos?.arrayValue?.values||[]).map(x=>x.stringValue)]
  .map(u=>objectPath(u,bucket)).filter(Boolean).map(p=>`gs://${bucket}/${p}`);
 return {database:r.database,id:r.name.split('/').pop(),updateTime:r.updateTime,userId:decode(f.userId),storageDraft:decode(f.storageDraft)||false,urls,...(r.referenceScope==='embedded'||includeEmbedded?{referenceScope:'embedded'}:{})};
}
export function prepare(snapshot) {
 if(snapshot.project!=='cc-livingcommunity-app'||snapshot.bucket!=='cc-livingcommunity-app.firebasestorage.app')throw Error('Wrong project/bucket');
 const plan=planLinks({bucket:snapshot.bucket,objects:snapshot.objects,records:snapshot.records.map(r=>normalizeRecord(r,snapshot.bucket))});
 const payload={project:snapshot.project,bucket:snapshot.bucket,...plan};
 return {payload,digest:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node prepare-plan.mjs private-snapshot.json private-plan.json');
 const plan=prepare(JSON.parse(fs.readFileSync(input,'utf8')));fs.writeFileSync(output,JSON.stringify(plan),{mode:0o600});fs.chmodSync(output,0o600);
 console.log(JSON.stringify({verifiedLinksReady:plan.payload.ready.length,alreadyLinked:plan.payload.alreadyLinked.length,held:plan.payload.held.length,digest:plan.digest}));
}
