// Authenticated media access contract. Never issues bearer download/signed URLs.
// Existing native Inbox is text-only. New group uploads stay disabled until this
// reader, verified object metadata, and matching clients are separately reviewed.
const { canSee, memberPath } = require('./inbox-groups.cjs');
async function authorizeGroupMedia(db, uid, {conversationId, messageId, attachmentId}) {
  if (![uid,conversationId,messageId,attachmentId].every(s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s))) throw Error('permission-denied');
  const [c,m,p,message]=await Promise.all([
    db.doc(`inbox_conversations/${conversationId}`).get(),db.doc(memberPath(conversationId,uid)).get(),
    db.doc(`users/${uid}`).get(),db.doc(`inbox_conversations/${conversationId}/messages/${messageId}`).get(),
  ]);
  if(!canSee(c.data(),m.data(),p.data(),message.data()))throw Error('permission-denied');
  const file=message.data().attachments?.find(f=>f.id===attachmentId);
  if(!file?.verified || file.quarantined || typeof file.path!=='string' || !file.path.startsWith(`inbox_groups/${conversationId}/${messageId}/`) || file.path.includes('..') || file.url || file.token)throw Error('permission-denied');
  return {path:file.path,cacheControl:'private, no-store',conversationId,messageId};
}
// A future HTTP adapter must verify Firebase ID tokens (including revocation),
// reauthorize each request/range, validate object conversation/message metadata,
// stream bytes, bound range/size, and never expose token-bearing URLs or log paths.
module.exports={authorizeGroupMedia};
