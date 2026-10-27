import { collection as collectionRef, doc, getDoc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';

export type SocialCollection = 'posts' | 'discussion_feed' | 'marketItems' | 'marketplace_posts';
/** A server-read canonical profile and a transaction, never a UI author/role claim. */
export async function mutateSocial(db: Firestore, uid: string, collection: SocialCollection, id: string,
  action: 'like' | 'comment' | 'sold' | 'delete', payload: { liked?: boolean; text?: string; commentId?: string; replyToCommentId?: string; sold?: boolean } = {}) {
  const profile = (await getDoc(doc(db, 'users', uid))).data();
  if (!profile || profile.approved !== true || profile.deletionPending === true || !['resident', 'admin', 'vip', 'crew'].includes(profile.role))
    throw Error('An approved account is required.');
  const ref = doc(db, collection, id);
  const commentId = payload.commentId || doc(collectionRef(db, collection)).id;
  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists() || snapshot.data().storageDraft !== false) throw Error('This item is not published.');
    const before = snapshot.data();
    const owner = before.userId ?? before.authorId;
    const manager = profile.role === 'admin' || profile.role === 'vip';
    if (action === 'delete') {
      if (owner !== uid && !manager) throw Error('Only the author or office can remove this item.');
      tx.delete(ref); return;
    }
    if (action === 'sold') {
      if (!['marketplace_posts', 'marketItems'].includes(collection) || owner !== uid && !manager)
        throw Error('Only the seller or office can change availability.');
      tx.update(ref, { sold: !!payload.sold, claimed: !!payload.sold, updatedAt: serverTimestamp() }); return;
    }
    if (action === 'like') {
      if (!['discussion_feed', 'posts'].includes(collection)) throw Error('This item does not support reactions.');
      const likedBy = before.likedBy || {};
      const old = likedBy[uid] === true;
      const next = payload.liked === true;
      if (old === next) return;
      const likes = Number.isInteger(before.likes) && before.likes >= 0 ? before.likes : 0;
      tx.update(ref, { likedBy: { ...likedBy, [uid]: next }, likes: likes + (next ? 1 : -1), updatedAt: serverTimestamp() }); return;
    }
    const text = payload.text?.trim();
    if (!text || text.length > 10000) throw Error('Enter a comment of up to 10,000 characters.');
    if (!Array.isArray(before.comments)) throw Error('This discussion needs a compatibility review.');
    if (before.comments.some(c => c.id === commentId)) return;
    let reply = {};
    if (payload.replyToCommentId) {
      const index = before.comments.findIndex(c => String(c.id) === payload.replyToCommentId);
      const parent = before.comments[index];
      if (collection !== 'discussion_feed' || !parent || typeof parent.authorId !== 'string' || !parent.authorId || parent.authorId.includes('/'))
        throw Error('This comment cannot receive a direct reply.');
      reply = {replyToCommentId: payload.replyToCommentId, replyToCommentIndex: index};
    }
    tx.update(ref, { comments: [...before.comments, { ...reply, id: commentId, authorId: uid,
      author: profile.name || 'Resident', authorAvatar: profile.avatarUrl || profile.avatar_url || '',
      authorEmail: '', unit: 'TownLoop Resident', text, timeAgo: 'Just now' }], updatedAt: serverTimestamp() });
  });
}
