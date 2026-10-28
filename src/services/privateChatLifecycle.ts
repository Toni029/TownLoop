/** Leave authority is an exact Firebase UID, never a name, email or hide cursor. */
export function privateChatPeer(data: Record<string, any>, uid: string): string | null {
  const ids = data.participantIds;
  if (data.identityVersion !== 2 || !Array.isArray(ids) || ids.length !== 2 ||
      ids.some(id => typeof id !== 'string' || !id || id.includes('/')) || ids[0] === ids[1] || !ids.includes(uid)) return null;
  return ids.find(id => id !== uid) || null;
}
export function privateChatLeft(data: Record<string, any>, uid: string): boolean {
  return !!data.leftBy && typeof data.leftBy === 'object' && !Array.isArray(data.leftBy) && data.leftBy[uid] === true;
}
