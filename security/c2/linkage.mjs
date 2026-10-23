/** Metadata only. No media bodies, deletion, renames or token rotation. */
export function objectPath(value, bucket) {
 if(typeof value!=='string')return null;
 if(value.startsWith(`gs://${bucket}/`))return value.slice(bucket.length+6);
 try{const u=new URL(value),prefix=`/v0/b/${bucket}/o/`;return u.protocol==='https:'&&u.hostname==='firebasestorage.googleapis.com'&&u.pathname.startsWith(prefix)?decodeURIComponent(u.pathname.slice(prefix.length)):null;}catch{return null;}
}
export function planLinks({bucket,records,objects}) {
 const refs=new Map(),ready=[],held=[],alreadyLinked=[];
 for(const r of records){if(!r.userId||r.storageDraft===true||!r.updateTime||!r.database||!/^[A-Za-z0-9_-]{1,128}$/.test(r.id))continue;
  for(const u of r.urls){const p=objectPath(u,bucket);if(!p?.startsWith('work_orders/')||p.split('/').length!==2)continue;const parents=refs.get(p)||new Map();parents.set(`${r.database}/${r.id}`,r);refs.set(p,parents);}}
 const seen=new Set();
 for(const o of objects.filter(o=>o.name.startsWith('work_orders/'))){
  if(seen.has(o.name))throw Error('Duplicate inventory object');seen.add(o.name);
  const parents=refs.get(o.name);
  const hold=reason=>held.push({path:o.name,reason});
  if(parents?.size!==1){hold(parents?'Multiple parent references':'No top-level parent proof; embedded references not read');continue;}
  const parent=[...parents.values()][0];
  if(parent.database!=='(default)'){hold('Named parent needs separate authority, never relabel as native');continue;}
  if(!o.generation||!o.metageneration||!o.metadata?.uploadedBy){hold('Incomplete object metadata');continue;}
  const patch={securityVersion:'1',collection:'work_orders',recordId:parent.id};
  if(o.metadata.securityVersion==='1'){
   if(Object.entries(patch).every(([k,v])=>o.metadata[k]===v))alreadyLinked.push({path:o.name});else hold('Existing link conflicts with verified parent');
   continue;
  }
  ready.push({path:o.name,generation:o.generation,metageneration:o.metageneration,parent,patch});
 }
 for(const p of refs.keys())if(!seen.has(p))held.push({path:p,reason:'Referenced object absent'});
 return {bucket,ready,held,alreadyLinked};
}
export async function applyLink(item,api) {
 if(Object.keys(item.patch||{}).sort().join(',')!=='collection,recordId,securityVersion'||item.patch.securityVersion!=='1'||item.patch.collection!=='work_orders'||item.patch.recordId!==item.parent.id)throw Error('Invalid linkage-only patch');
 const checkParent=async()=>{const p=await api.readParent(item.parent);if(p.updateTime!==item.parent.updateTime||p.userId!==item.parent.userId||p.storageDraft===true||!p.urls.some(u=>objectPath(u,api.bucket||item.bucket)===item.path))throw Error('Parent changed; replan required');};
 // The caller supplies the bucket from the immutable plan envelope.
 await checkParent();const current=await api.readObject(item.path);
 if(current.generation!==item.generation)throw Error('Object changed; replan required');
 if(Object.entries(item.patch).every(([k,v])=>current.metadata?.[k]===v))return 'already-applied';
 if(current.metageneration!==item.metageneration)throw Error('Object changed; replan required');
 try{await api.patchMetadata(item.path,{...current.metadata,...item.patch},{generation:item.generation,metageneration:item.metageneration});await checkParent();}
 catch(error){error.requiresReconciliation=true;throw error;}
 return 'applied';
}
