const { createHash } = require('node:crypto');
const canonical = new Set(['resident', 'admin', 'vip', 'crew']);
const approved = profile => profile?.approved === true && !profile.deletionPending && canonical.has(profile.role);
const manager = profile => approved(profile) && ['admin', 'vip'].includes(profile.role);
function id(value) { return typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/'); }
function reportInput(input) {
  const kinds = ['post', 'listing', 'comment', 'user'];
  const reasons = ['harassment', 'spam', 'unsafe', 'privacy', 'other'];
  if (!input || !kinds.includes(input.kind) || !id(input.id) || !reasons.includes(input.reason)) throw Error('Invalid report.');
  if (input.kind === 'comment' && (!id(input.commentId) || !['discussion_feed', 'marketplace_posts', 'posts', 'marketItems'].includes(input.collection))) throw Error('Choose an existing comment.');
  if (typeof (input.details || '') !== 'string' || (input.details || '').length > 1000) throw Error('Keep report details under 1,000 characters.');
  return { kind: input.kind, id: input.id, commentId: input.kind === 'comment' ? input.commentId : '',
    collection: input.kind === 'post' ? 'discussion_feed' : input.kind === 'listing' ? 'marketplace_posts' : input.kind === 'comment' ? input.collection : 'users',
    reason: input.reason, details: (input.details || '').trim() };
}
const reportKey = (uid, target) => createHash('sha256').update(JSON.stringify([uid, target.collection, target.id, target.commentId])).digest('hex');
function reportTarget(target, data, uid) {
  if (!data) throw Error('This item is no longer available.');
  const comment = target.kind === 'comment' ? (data.comments || []).filter(c => String(c.id) === target.commentId) : null;
  if (comment && comment.length !== 1) throw Error('This comment needs an office review.');
  const author = target.kind === 'user' ? target.id : comment ? comment[0].authorId : data.userId || data.authorId;
  if (author === uid) throw Error('You cannot report your own content.');
  // Unknown legacy authors remain unassigned; never resolve identities from names.
  return typeof author === 'string' && id(author) ? author : null;
}
module.exports = { approved, manager, id, reportInput, reportKey, reportTarget };
