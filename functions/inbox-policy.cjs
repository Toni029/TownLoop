const collections = { resident_chats: 'friend', office_chats: 'office', maintenance_chats: 'maintenance', marketplace_chats: 'marketplace' };
const { isDeepStrictEqual } = require('node:util');
function aliases(p) { return typeof p?.id === 'string' && p.id ? [p.id] : []; }
const approved = p => !!p && p.approved === true && !p.deletionPending && ['resident', 'admin', 'vip', 'crew'].includes(p.role);
function member(collection, chat, user) {
  if (!chat || !approved(user)) return false;
  const ids = aliases(user);
  if (collection === 'marketplace_chats') return Array.isArray(chat.participantIds) && chat.participantIds.length === 2 && chat.buyerId !== chat.sellerId && chat.participantIds.includes(chat.buyerId) && chat.participantIds.includes(chat.sellerId) && chat.participantIds.includes(user.id) && [chat.buyerId,chat.sellerId].includes(user.id) && !['buyer','seller'].some(side => chat[side+'Left'] === true || chat['deletedBy'+side[0].toUpperCase()+side.slice(1)] === true || chat.deletedBy?.includes(side));
  if (collection === 'resident_chats') return chat.identityVersion === 2 && (chat.participantIds || []).some(id => ids.includes(id));
  const staff = collection === 'office_chats' ? ['admin', 'vip'].includes(user.role) : user.role === 'crew';
  return staff || chat.residentId === user.id;
}
function appendedMessage(before, after, sender) {
  const old = before?.messages || [], next = after?.messages || [];
  if (!Array.isArray(old) || !Array.isArray(next) || !approved(sender) || next.length !== old.length + 1) return null;
  const msg = next.at(-1);
  const marketplace = after.sellerId && after.buyerId;
  if (msg?.type === 'leave' || msg?.isSystem === true) return null;
  if (!msg || typeof msg.id !== 'string' || !msg.id || typeof (marketplace ? msg.text : msg.body) !== 'string' || !(marketplace ? msg.text : msg.body).trim() || (marketplace ? msg.text : msg.body).length > 10000) return null;
  if (msg.senderId !== sender.id || (!marketplace && msg.senderRole !== sender.role) || msg.senderName !== (sender.name || 'Resident')) return null;
  // Read receipts/history edits must not create notifications or replay old IDs.
  if (old.some(m => m.id === msg.id) || !isDeepStrictEqual(old, next.slice(0, -1))) return null;
  return msg;
}
function recipients(collection, chat, profiles, senderId) {
  return profiles.filter(p => p.id !== senderId && member(collection, chat, p) &&
    (!['office_chats','maintenance_chats'].includes(collection) || senderId === chat.residentId || p.id === chat.residentId));
}
module.exports = { collections, aliases, approved, member, appendedMessage, recipients };
