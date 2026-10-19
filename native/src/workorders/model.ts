import { displayWorkOrderCode } from '../../../src/data/workOrderNumber.ts';
import type { WorkOrderItem, WorkOrderComment, UserProfile } from '../../../src/types';
import { getCategoryEmoji } from '../../../src/data/workOrderCategories.ts';
export type WorkOrder = WorkOrderItem & {createdAt:number};
function submissionTime(value: any): number {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  return typeof value === "string" ? Number(value) || Date.parse(value) || 0 : 0;
}
export function sortWorkOrders(orders: WorkOrder[]): WorkOrder[] {
  return [...orders].sort((a,b) => Number(a.status === "Done") - Number(b.status === "Done") || a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
}
export function readWorkOrder(id:string, d:Record<string,any>):WorkOrder {
  return {resolutionNote:d.resolutionNote,resolutionCommentId:d.resolutionCommentId,resolutionCommentIndex:d.resolutionCommentIndex,resolutionAuthorId:d.resolutionAuthorId,id,code:displayWorkOrderCode(d.code || `WO-${id.slice(-4)}`),title:d.title || 'Work Order',description:d.description || '',category:d.category || 'General Maintenance',categoryEmoji:d.categoryEmoji || getCategoryEmoji(d.category || ''),unit:d.unit || 'Resident Unit',placeInLine:d.placeInLine || 1,aheadCount:d.aheadCount || 0,status:d.status || 'Queued',statusNote:d.statusNote || 'Pending review',timeAgo:d.timeAgo || 'Recent',completedAt:typeof d.completedAt?.toDate === 'function' ? d.completedAt.toDate().toISOString() : d.completedAt,completedBy:d.completedBy,photoUrl:d.photoUrl,photos:d.photos || (d.photoUrl ? [d.photoUrl] : []),comments:Array.isArray(d.comments) ? d.comments : [],userId:d.userId,userEmail:d.userEmail,userName:d.userName,createdAt:submissionTime(d.createdAt)};
}
/** The displayed oldest-first pending list determines queue position. */
export function queueState(order:WorkOrderItem, all:WorkOrderItem[]) {
  const done = order.status === 'Done';
  const index = done ? -1 : all.filter(w=>w.status !== 'Done').findIndex(w=>String(w.id) === String(order.id));
  const place = index>=0 ? index+1 : order.placeInLine || 1;
  return {done,inProgress:!done && (index===0 || (index===-1 && order.placeInLine===1)),place,ahead:index>=0 ? index : Math.max(0,place-1)};
}
/** Legacy tickets have no author UID; only migrate the last completion's matching author/text. */
export function editableResolution(order: WorkOrderItem, user: UserProfile | null): WorkOrderComment | null {
  if (!user || (user.role !== 'crew' && !user.isCrew)) return null;
  const comments = order.comments || [];
  if (order.resolutionCommentId != null) {
    if (order.resolutionAuthorId !== String(user.id)) return null;
    const found = comments.find(c => c.id === order.resolutionCommentId && (!c.authorId || c.authorId === String(user.id)));
    if (found && (order.status !== 'Done' || (found.text === order.resolutionNote && found.author === order.completedBy))) return found;
    // A legacy web completion may have appended a newer resolution without updating its pointer.
    if (order.status !== 'Done') return null;
  }
  if (!order.resolutionNote || order.completedBy !== user.name) return null;
  const last = comments[comments.length - 1];
  return last && last.author === user.name && last.role === 'Maintenance Crew' && last.text === order.resolutionNote && (!last.authorId || last.authorId === String(user.id)) ? last : null;
}
export function resolutionPatch(order:WorkOrderItem,user:UserProfile,comment:WorkOrderComment | null,now:string) {
  if (user.role !== 'crew' && !user.isCrew) throw new Error('Only maintenance crew can complete work orders.');
  if (order.status === 'Done') return null;
  if (!comment?.text.trim()) throw new Error('A resolution note is required before marking as done.');
  const existing = editableResolution(order, user);
  const comments = [...(order.comments || [])];
  const index = existing ? comments.findIndex(c => c.id === existing.id) : comments.length;
  const next: WorkOrderComment = existing ? {
    ...existing, text: comment.text.trim(), photoUrl: comment.photoUrl || existing.photoUrl || '', editedAt: now,
    revisions: [...(existing.revisions || []), {text:existing.text,photoUrl:existing.photoUrl || '',timestamp:existing.timestamp,editedAt:existing.editedAt || ''}],
  } : {...comment, text:comment.text.trim(),authorId:String(user.id)};
  if (existing) comments[index] = next; else comments.push(next);
  return {status:'Done' as const,statusNote:`Completed by ${user.name}`,completedAt:now,completedBy:user.name,resolutionNote:next.text,
    resolutionCommentId:next.id,resolutionCommentIndex:index,resolutionAuthorId:String(user.id),
    ...(next.photoUrl ? {photoUrl:next.photoUrl,latestResolutionPhoto:next.photoUrl} : {}),comments};
}
