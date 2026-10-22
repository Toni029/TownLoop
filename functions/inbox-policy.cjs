const collections = { resident_chats: 'friend', office_chats: 'office', maintenance_chats: 'maintenance' };
const { isDeepStrictEqual } = require('node:util');
function aliases(p) { return typeof p?.id === 'string' && p.id ? [p.id] : []; }
const approved = p => !!p && p.approved === true && ['resident', 'admin', 'vip', 'crew'].includes(p.role);
function member(collection, chat, user) {
  if (!approved(user)) return false;
  const ids = aliases(user);
  if (collection === 'resident_chats') return chat.identityVersion === 2 && (chat.participantIds || []).some(id => ids.includes(id));
  const staff = collection === 'office_chats' ? ['admin', 'vip'].includes(user.role) : user.role === 'crew';
  return staff || chat.residentId === user.id;
}
function appendedMessage(before, after, sender) {
  const old = before?.messages || [], next = after?.messages || [];
  if (!approved(sender) || next.length !== old.length + 1) return null;
  const msg = next.at(-1);
  if (!msg || typeof msg.id !== 'string' || !msg.id || typeof msg.body !== 'string' || !msg.body.trim() || msg.body.length > 10000) return null;
  if (msg.senderId !== sender.id || msg.senderRole !== sender.role || msg.senderName !== (sender.name || 'Resident')) return null;
  // Read receipts/history edits must not create notifications or replay old IDs.
  if (old.some(m => m.id === msg.id) || !isDeepStrictEqual(old, next.slice(0, -1))) return null;
  return msg;
}
function recipients(collection, chat, profiles, senderId) {
  return profiles.filter(p => p.id !== senderId && member(collection, chat, p));
}
module.exports = { collections, aliases, approved, member, appendedMessage, recipients };
