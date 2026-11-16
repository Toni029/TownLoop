// Chat previews retain their own byte-identical copies; messages/history are never rewritten.
const {createHash,randomUUID}=require('node:crypto');
const {canonicalPath}=require('./databaseCleanupStorage.cjs');
const hash=x=>createHash('sha256').update(x).digest('hex');
async function preserveChatPreviews(db,bucket,job,path,metadata){
 if(job.collection!=='marketplace_posts')return;
 const chats=await db.collection('marketplace_chats').where('itemId','==',job.recordId).limit(101).get();if(chats.size>100)throw Error('chat_preview_inventory_bound');
 for(const row of chats.docs){const sourceDigest=hash(path+':'+metadata.generation);
  const key=await db.runTransaction(async tx=>{const current=await tx.get(row.ref);if(!current.exists)return null;const chat=current.data();if(chat.itemId!==job.recordId||canonicalPath(chat.itemMediaUrl)!==path)return null;
   if(typeof chat.sellerId!=='string'||typeof chat.buyerId!=='string'||chat.sellerId===chat.buyerId||!Array.isArray(chat.participantIds)||chat.participantIds.length!==2||!chat.participantIds.includes(chat.sellerId)||!chat.participantIds.includes(chat.buyerId))throw Error('chat_identity_requires_review');
   if(chat.previewCopySource===sourceDigest&&typeof chat.previewCopyKey==='string'&&/^[a-f0-9-]{36}$/.test(chat.previewCopyKey))return chat.previewCopyKey;
   const key=randomUUID();tx.update(row.ref,{previewCopyKey:key,previewCopySource:sourceDigest});return key;
  });if(!key)continue;
  const name='marketplace/chat-preview_'+key,target=bucket.file(name),proof={securityVersion:'chat-preview-v1',collection:'marketplace_preview',recordId:key,sourceDigest,uploadedBy:job.uid,firebaseStorageDownloadTokens:''};
  try{await bucket.file(path,{generation:String(metadata.generation)}).copy(target,{preconditionOpts:{ifGenerationMatch:0},contentType:metadata.contentType,metadata:proof});}catch(e){if(e.code!==412)throw e;}
  const [saved]=await target.getMetadata();if(saved.metadata?.collection!==proof.collection||saved.metadata?.recordId!==key||saved.metadata?.sourceDigest!==sourceDigest||String(saved.size)!==String(metadata.size)||saved.crc32c!==metadata.crc32c||Date.parse(saved.timeCreated)<Date.parse('2026-10-23T12:57:03.246Z'))throw Error('chat_preview_copy_unverified');
  await db.runTransaction(async tx=>{const current=await tx.get(row.ref);if(!current.exists)return;const chat=current.data();if(chat.itemId!==job.recordId||chat.previewCopyKey!==key||chat.previewCopySource!==sourceDigest)throw Error('chat_preview_identity_changed');if(canonicalPath(chat.itemMediaUrl)===path)tx.update(row.ref,{itemMediaUrl:'gs://'+bucket.name+'/'+name});});
 }
}
module.exports={preserveChatPreviews};
