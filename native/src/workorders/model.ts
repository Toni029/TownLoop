import type { WorkOrderItem, WorkOrderComment, UserProfile } from '../../../src/types';
import { getCategoryEmoji } from '../../../src/data/workOrderCategories.ts';
export type WorkOrder = WorkOrderItem & {createdAt:number};
export function readWorkOrder(id:string, d:Record<string,any>):WorkOrder {
  return {id,code:d.code || `WO-${id.slice(-4)}`,title:d.title || 'Work Order',description:d.description || '',category:d.category || 'General Maintenance',categoryEmoji:d.categoryEmoji || getCategoryEmoji(d.category || ''),unit:d.unit || 'Resident Unit',placeInLine:d.placeInLine || 1,aheadCount:d.aheadCount || 0,status:d.status || 'Queued',statusNote:d.statusNote || 'Pending review',timeAgo:d.timeAgo || 'Recent',completedAt:d.completedAt,completedBy:d.completedBy,photoUrl:d.photoUrl,photos:d.photos || (d.photoUrl ? [d.photoUrl] : []),comments:Array.isArray(d.comments) ? d.comments : [],userId:d.userId,userEmail:d.userEmail,userName:d.userName,createdAt:typeof d.createdAt?.toMillis === 'function' ? d.createdAt.toMillis() : Number(d.createdAt) || 0};
}
/** Matches WorkOrdersScreen on main; the full newest-first list determines position. */
export function queueState(order:WorkOrderItem, all:WorkOrderItem[]) {
  const done = order.status === 'Done';
  const index = done ? -1 : all.filter(w=>w.status !== 'Done').findIndex(w=>String(w.id) === String(order.id));
  const place = index>=0 ? index+1 : order.placeInLine || 1;
  return {done,inProgress:!done && (index===0 || (index===-1 && order.placeInLine===1)),place,ahead:index>=0 ? index : Math.max(0,place-1)};
}
export function resolutionPatch(order:WorkOrderItem,user:UserProfile,comment:WorkOrderComment | null,now:string) {
  if (user.role !== 'crew' && !user.isCrew) throw new Error('Only maintenance crew can complete work orders.');
  if (order.status === 'Done') return null;
  const proof=comment || order.comments?.find(c=>!!c.photoUrl && !!c.text?.trim());
  if (!proof?.text.trim() || !proof.photoUrl) throw new Error('Both a reply note and a picture are required before marking as done.');
  return {status:'Done' as const,statusNote:`Completed by ${user.name}`,completedAt:now,completedBy:user.name,photoUrl:proof.photoUrl,latestResolutionPhoto:proof.photoUrl,comments:comment ? [...(order.comments || []),comment] : order.comments || []};
}
