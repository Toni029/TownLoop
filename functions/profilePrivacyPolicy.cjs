// Shared by the trusted projection trigger and the offline migration planner.
const ROLES = new Set(['resident', 'crew', 'vip', 'admin']);
function directoryProjection(uid, profile) {
  if (!profile || profile.approved !== true || profile.deletionPending === true || !ROLES.has(profile.role)) return null;
  const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const avatar = text(profile.avatarUrl || profile.avatar_url, 700000);
  return {
    uid,
    name: text(profile.name || profile.displayName, 200) || 'Resident',
    avatarUrl: /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(avatar) ? avatar : '',
    role: profile.role,
    approved: true,
  };
}
async function syncDirectoryProfile(db, uid) {
  // Re-read current source inside the transaction: Firestore events may arrive out of order.
  // This also prevents an old approval event from restoring a removed/revoked resident.
  return db.runTransaction(async transaction => {
    const source = await transaction.get(db.doc(`users/${uid}`));
    const target = db.doc(`resident_directory/${uid}`);
    const projection = directoryProjection(uid, source.exists ? source.data() : null);
    if (projection) transaction.set(target, projection); // replace removes legacy sensitive fields
    else transaction.delete(target);
  });
}
module.exports = { directoryProjection, syncDirectoryProfile };
