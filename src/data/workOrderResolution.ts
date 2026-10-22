import type { WorkOrderItem, WorkOrderComment, UserProfile } from '../types';
import { getUserRole } from '../utils/permissions';
/** Only exact authenticated author UIDs authorize revisions; legacy names never prove ownership. */
export function editableResolution(order: WorkOrderItem, user: UserProfile | null): WorkOrderComment | null {
  if (!user || getUserRole(user) !== 'crew') return null;
  const comments = order.comments || [];
  if (order.resolutionCommentId != null) {
    if (order.resolutionAuthorId !== String(user.id)) return null;
    const found = comments.find(c => c.id === order.resolutionCommentId && c.authorId === String(user!.id));
    if (found && (order.status !== 'Done' || (found.text === order.resolutionNote && found.author === order.completedBy))) return found;
    // A legacy web completion may have appended a newer resolution without updating its pointer.
    if (order.status !== 'Done') return null;
  }
  if (!order.resolutionNote || order.completedBy !== user.name) return null;
  const last = comments[comments.length - 1];
  return last && last.author === user.name && last.role === 'Maintenance Crew' && last.text === order.resolutionNote && last.authorId === String(user!.id) ? last : null;
}
export function resolutionPatch(order:WorkOrderItem,user:UserProfile,comment:WorkOrderComment | null,now:string) {
  if (getUserRole(user) !== 'crew') throw new Error('Only maintenance crew can complete work orders.');
  if (order.status === 'Done') return null;
  if (!comment?.text.trim()) throw new Error('A resolution note is required before marking as done.');
  const existing = editableResolution(order, user);
  const comments = [...(order.comments || [])];
  const index = existing ? comments.findIndex(c => c.id === existing.id) : comments.length;
  const next: WorkOrderComment = existing ? {
    ...existing, text: comment.text.trim(), photoUrl: comment.photoUrl || existing.photoUrl || '', editedAt: now,
    revisions: [...(existing.revisions || []), {text:existing.text,photoUrl:existing.photoUrl || '',timestamp:existing.timestamp,editedAt:existing.editedAt || ''}],
  } : {...comment, kind:'resolution' as const, text:comment.text.trim(),authorId:String(user.id)};
  if (existing) comments[index] = next; else comments.push(next);
  return {status:'Done' as const,statusNote:`Completed by ${user.name}`,completedAt:now,completedBy:user.name,resolutionNote:next.text,
    resolutionCommentId:next.id,resolutionCommentIndex:index,resolutionAuthorId:String(user.id),
    ...(next.photoUrl ? {photoUrl:next.photoUrl,latestResolutionPhoto:next.photoUrl} : {}),comments};
}

/** Only explicitly tagged resolutions or the authoritative legacy completion are eligible. */
export function isResolutionComment(order: WorkOrderItem, comment: WorkOrderComment): boolean {
  return comment.role === 'Maintenance Crew' && (comment.kind === 'resolution' || comment.id === order.resolutionCommentId ||
    (order.status === 'Done' && comment.text === order.resolutionNote && comment.author === order.completedBy));
}
export function removeResolutionComment(order: WorkOrderItem, user: UserProfile, id: string, now: string) {
  if (!['admin', 'vip'].includes(getUserRole(user))) throw new Error('Only Admin and VIP can delete resolution comments.');
  const comments = order.comments || [];
  const index = comments.findIndex(c => String(c.id) === id);
  if (index < 0) return null;
  if (!isResolutionComment(order, comments[index])) throw new Error('This is not a crew resolution comment.');
  const remaining = comments.filter((_, i) => i !== index);
  const activeIndex = remaining.findIndex(c => c.id === order.resolutionCommentId);
  return { comments: remaining, removed: comments[index], activeIndex,
    audit: {comment:comments[index],deletedBy:String(user.id),deletedAt:now} };
}
