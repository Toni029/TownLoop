// Bounded, resumable cursor scans. Invoked only by the separately prepared, gated entry.
const {assessConversation,addCalendarMonths}=require('./inbox-retention.cjs');
const {hash}=require('./inbox-groups.cjs');
const SOURCES=['inbox_conversations','resident_chats','office_chats','maintenance_chats'];
async function scanRetentionPage(db,{enabled=false,now=Date.now(),pageSize=25}={}){
 if(!enabled)return{state:'disabled'};
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw Error('invalid-argument');
 const cursorRef=db.doc('inbox_retention_cursors/scan'),cursor=(await cursorRef.get()).data()||{},source=SOURCES.includes(cursor.source)?cursor.source:SOURCES[0];
 let query=db.collection(source).orderBy('__name__');if(cursor.after)query=query.startAfter(cursor.after);
 const rows=await query.limit(pageSize).get(),results=[];
 for(const row of rows.docs){
  if(source==='inbox_conversations')results.push(await assessConversation(db,row.id,{now}));
  else if(!row.data().groupConversationId){
   const old=row.data(),messages=Array.isArray(old.messages)?old.messages:[];
   const dates=messages.filter(m=>m.type!=='leave'&&!m.isSystem).map(m=>m.createdAt);
   const latest=dates.length?dates.reduce((a,b)=>Math.max(a,b),-Infinity):old.createdAt;
   const abandoned=old.sideLeft?.resident===true&&old.sideLeft?.team===true||
    Array.isArray(old.participantIds)&&old.participantIds.length>=2&&old.participantIds.every(uid=>old.leftBy?.[uid]===true);
   if(!abandoned&&Number.isFinite(latest)&&addCalendarMonths(latest,6)>now)continue;
   // leftBy/team-wide flags and names do not prove a complete per-person roster.
   // Unknown older chats enter a human-review queue instead of a destructive migration.
   const id=`legacy_${hash(`${source}/${row.id}`)}`,ref=db.doc(`inbox_cleanup_requests/${id}`);
   await db.runTransaction(async tx=>{
    const current=(await tx.get(row.ref)).data(),previous=(await tx.get(ref)).data();
    if(!current||current.groupConversationId||previous?.status==='needs_review')return;
    tx.set(ref,{kind:'legacy',legacySource:`${source}/${row.id}`,status:'needs_review',reason:'authoritative_legacy_membership_required',updatedAt:now});
   });
   results.push({state:'needs_review'});
  }
 }
 // Cursor checkpoints only after successful page handling. Repeated pages are idempotent.
 await db.runTransaction(async tx=>{const old=(await tx.get(cursorRef)).data()||{};
  if(old.source!==cursor.source||old.after!==cursor.after)return;
  tx.set(cursorRef,rows.docs.length===pageSize?{source,after:rows.docs.at(-1).id}:{source:SOURCES[(SOURCES.indexOf(source)+1)%SOURCES.length],after:null});
 });
 return{state:'scanned',count:rows.docs.length,results};
}
async function cleanupRetentionPage(db,storage,{enabled=false,now=Date.now(),pageSize=10,clock=()=>Date.now()}={}){
 if(!enabled)return{state:'disabled'};
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>25)throw Error('invalid-argument');
 const {runConversationCleanup}=require('./inbox-group-cleanup-runner.cjs');
 const cursorRef=db.doc('inbox_retention_cursors/cleanup'),cursor=(await cursorRef.get()).data()||{};
 let q=db.collection('inbox_cleanup_requests').orderBy('__name__');if(cursor.after)q=q.startAfter(cursor.after);
 const rows=await q.limit(pageSize).get(),results=[];
 for(const row of rows.docs){
  const r=row.data();
  if(r.status==='completed'&&Number.isFinite(r.expiresAt)&&r.expiresAt<=now&&/^v3_[a-f0-9]{64}$/.test(row.id)){
   await db.runTransaction(async tx=>{const [current,root]=await Promise.all([tx.get(row.ref),tx.get(db.doc(`inbox_conversations/${row.id}`))]);
    if(!root.exists&&current.data()?.status==='completed'&&current.data().expiresAt<=now)tx.delete(row.ref);});continue;
  }
  if(!r.conversationId||!/^v3_[a-f0-9]{64}$/.test(r.conversationId)||!['awaiting_separate_approval','retry_required','processing'].includes(r.status)||r.nextAttemptAt>now||!Number.isFinite(r.deleteAfter)||r.deleteAfter>now)continue;
  const result=await runConversationCleanup(db,storage,r.conversationId,{enabled:true,now,clock});results.push(result);
  // Missing authorization needs staff review, not an hourly retry storm.
  if(result.state==='held')await db.runTransaction(async tx=>{
   const current=(await tx.get(row.ref)).data();
   if(current?.status===r.status&&current.deleteAfter===r.deleteAfter)tx.update(row.ref,{status:'needs_review',reason:result.reason});
  });
 }
 await db.runTransaction(async tx=>{const old=(await tx.get(cursorRef)).data()||{};if(old.after!==cursor.after)return;
  tx.set(cursorRef,{after:rows.docs.length===pageSize?rows.docs.at(-1).id:null});});
 return{state:'scanned',results};
}
module.exports={scanRetentionPage,cleanupRetentionPage};
