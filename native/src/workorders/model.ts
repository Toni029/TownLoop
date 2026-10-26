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
  return [...orders].sort((a,b) => Number(a.status === "Done") - Number(b.status === "Done") || a.createdAt - b.createdAt || (String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0));
}
export function pendingQueuePositions(orders: WorkOrder[]): Map<string, number> {
  const positions = new Map<string, number>();
  for (const order of sortWorkOrders(orders)) if (order.status !== 'Done') positions.set(String(order.id), positions.size + 1);
  return positions;
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
export { editableResolution, resolutionPatch, isResolutionComment, removeResolutionComment } from '../../../src/data/workOrderResolution.ts';
