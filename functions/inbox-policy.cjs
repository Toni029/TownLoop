const collections = { resident_chats: 'friend', office_chats: 'office', maintenance_chats: 'maintenance' };
function aliases(p) {
  return [...new Set([p.id, p.email].filter(Boolean).flatMap(v => {
    const raw = String(v).trim().toLowerCase(); return [raw, raw.replace(/[^a-zA-Z0-9_-]/g, '_')];
  }))];
}
const approved = p => !!p && p.approved === true;
function member(collection, chat, user) {
  if (!approved(user)) return false;
  const ids = aliases(user);
  if (collection === 'resident_chats') return (chat.participantIds || []).some(id => ids.includes(String(id).toLowerCase()));
  const staff = collection === 'office_chats' ? ['admin', 'vip'].includes(user.role) : user.role === 'crew';
  return staff || String(chat.residentId) === user.id || (!!user.email && chat.residentEmail?.toLowerCase() === user.email.toLowerCase());
}
function appendedMessage(before, after, sender) {
  const old = before?.messages || [], next = after?.messages || [];
  if (!approved(sender) || next.length !== old.length + 1) return null;
  const msg = next.at(-1);
  if (!msg || typeof msg.id !== 'string' || !msg.id || typeof msg.body !== 'string' || !msg.body.trim() || msg.body.length > 10000) return null;
  if (!aliases(sender).includes(String(msg.senderId).toLowerCase())) return null;
  // Read receipts/history edits must not create notifications or replay old IDs.
  if (old.some((m, i) => m.id === msg.id || next[i]?.id !== m.id)) return null;
  return msg;
}
function recipients(collection, chat, profiles, senderId) {
  return profiles.filter(p => p.id !== senderId && member(collection, chat, p));
}
module.exports = { collections, aliases, approved, member, appendedMessage, recipients };
