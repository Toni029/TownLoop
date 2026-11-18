'use strict';
const {createHash}=require('node:crypto');
const {FieldValue}=require('firebase-admin/firestore');
const COLLECTIONS=new Set(['work_orders','discussion_feed','posts','marketplace_posts','marketItems']);
function bodyDigest(data){
 const body={...data};delete body.databaseCleanupLock;
 const canonical=value=>{
  if(value===null)return ['null'];
  if(Array.isArray(value))return ['array',value.map(canonical)];
  if(value instanceof Date)return ['date',value.toISOString()];
  if(Buffer.isBuffer(value))return ['bytes',value.toString('base64')];
  if(value&&typeof value.toMillis==='function')return ['timestamp',value.seconds,value.nanoseconds];
  if(value&&typeof value==='object'){
   if(value.path&&value.firestore)return ['reference',value.firestore.projectId,value.firestore.databaseId,value.path];
   return ['map',Object.keys(value).sort().map(key=>[key,canonical(value[key])])];
  }
  return [typeof value,typeof value==='number'?String(value):value];
 };
 return createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
}
function root(ref){return ref.path.split('/').length===2&&COLLECTIONS.has(ref.path.split('/')[0]);}
async function readDocuments(reader,refs,fields){
 const full=refs.filter(root),masked=refs.filter(ref=>!root(ref));
 const rows=(await Promise.all([full.length?reader.getAll(...full):[],masked.length?reader.getAll(...masked,{fieldMask:fields}):[]])).flat(),byPath=new Map(rows.map(doc=>[doc.ref.path,doc]));return refs.map(ref=>byPath.get(ref.path));
}
function version(doc){
 if(!doc.exists)return null;
 const lock=doc.data()?.databaseCleanupLock;
 // The lock is server-only. Full-parent content hashes preserve the confirmed
 // version across lock/unlock metadata writes, never across resident-data changes.
 if(lock&&/^cleanup_[a-f0-9]{40}$/.test(lock.jobId||'')&&/^\d+:\d+$/.test(lock.originalVersion||'')&&lock.bodySha256===bodyDigest(doc.data()))return lock.originalVersion;
 return `${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}`;
}
async function freeze(tx,db,job,item){
 if(!COLLECTIONS.has(item.path.split('/')[0]))return false;
 const ref=db.doc(item.path),snap=await tx.get(ref),expected=item.documents.find(d=>d.path===item.path)?.version;
 if(!snap.exists)return false;
 if(version(snap)!==expected)throw Error('cleanup_record_changed');
 const previous=snap.data().databaseCleanupLock;
 if(previous?.blocked===true&&previous.jobId!==job.id)throw Error('cleanup_parent_lock_conflict');
 tx.update(ref,{databaseCleanupLock:{jobId:job.id,blocked:true,originalVersion:expected,bodySha256:bodyDigest(snap.data()),at:FieldValue.serverTimestamp()}});return true;
}
async function releaseOne(db,job){
 const ref=db.doc('database_cleanup_jobs/'+job.id),rows=await ref.collection('items').where('parentStorageLocked','==',true).limit(1).get();if(rows.empty)return false;
 const row=rows.docs[0];
 await db.runTransaction(async tx=>{
  const [active,control,current]=await Promise.all([tx.get(ref),tx.get(db.doc('database_cleanup_control/active')),tx.get(row.ref)]),parent=db.doc(current.data().path),snap=await tx.get(parent);
  if(active.data()?.lease!==job.lease||control.data()?.jobId!==job.id||control.data()?.referenceWritesBlocked!==true)throw Error('cleanup_parent_unlock_conflict');
  if(snap.exists&&snap.data().databaseCleanupLock?.jobId===job.id)tx.update(parent,{databaseCleanupLock:{jobId:job.id,blocked:false,originalVersion:version(snap),bodySha256:bodyDigest(snap.data()),at:FieldValue.serverTimestamp()}});
  tx.update(row.ref,{parentStorageLocked:false});
 });return true;
}
module.exports={COLLECTIONS,version,freeze,releaseOne,readDocuments,bodyDigest};
