import { doc, collection, runTransaction, serverTimestamp, deleteField } from 'firebase/firestore';
import { canCreateWorkOrder, canDeleteWorkOrder, canViewWorkOrder, isCrew } from '../../../src/utils/permissions';
import { getCategoryEmoji } from '../../../src/data/workOrderCategories';
import type { WorkOrderComment } from '../../../src/types';
import { db } from '../lib/firebase';
import { approvedUser } from '../news/actions';
import { singleFlight } from '../news/model';
import { readWorkOrder, resolutionPatch } from './model';
export const runWorkOrder = singleFlight();
export const newOrderId=()=>doc(collection(db,'work_orders')).id;
export async function submitWorkOrder(id:string,draft:{title:string;description:string;category:string;photos:string[]}) {
  return runWorkOrder(`submit:${id}`,async()=>{
    if (!draft.title.trim()) throw new Error('Please describe what needs fixing.');
    const user=await approvedUser();
    if (!canCreateWorkOrder(user)) throw new Error('This role cannot submit maintenance requests.');
    const reference=doc(db,'work_orders',id);
    await runTransaction(db,async tx=>{
      if ((await tx.get(reference)).exists()) return;
      tx.set(reference,{title:draft.title.trim(),description:draft.description.trim(),category:draft.category,categoryEmoji:getCategoryEmoji(draft.category),photos:draft.photos,photoUrl:draft.photos[0] || '',unit:user.address || user.apartmentNumber || user.unit || 'Resident Unit',userId:String(user.id),userName:user.name,userEmail:user.email,code:`WO-${Math.floor(1000+Math.random()*9000)}`,status:'Queued',statusNote:'Queued for maintenance technician',placeInLine:1,aheadCount:0,comments:[],createdAt:serverTimestamp(),timeAgo:'Just now'});
    });
  });
}
export async function changeWorkOrder(id:string,action:'delete'|'reopen'|'complete'|'note',text='',photo='',commentId=doc(collection(db,'work_orders')).id) {
  return runWorkOrder(`order:${id}`,async()=>{
    const user=await approvedUser();
    const reference=doc(db,'work_orders',id);
    await runTransaction(db,async tx=>{
      const snap=await tx.get(reference);
      if (!snap.exists()) throw new Error('This work order is no longer available.');
      const order=readWorkOrder(id,snap.data());
      if (!canViewWorkOrder(order,user)) throw new Error('You cannot access this work order.');
      if (action==='delete') {
        if (!canDeleteWorkOrder(order,user)) throw new Error('You cannot delete this work order.');
        tx.delete(reference); return;
      }
      if (!isCrew(user)) throw new Error('Only maintenance crew can service work orders.');
      if (action==='reopen') {
        if (order.status!=='Done') return;
        tx.update(reference,{status:'In Progress',statusNote:'Reopened for maintenance inspection',completedAt:deleteField(),completedBy:deleteField(),updatedAt:serverTimestamp()});return;
      }
      const comment:WorkOrderComment | null=text.trim() ? {id:commentId,author:user.name,role:'Maintenance Crew',text:text.trim(),timestamp:'Just now',photoUrl:photo} : null;
      if (action==='complete') {
        const patch=resolutionPatch(order,{...user,role:'crew'},comment,new Date().toISOString());
        if (patch) tx.update(reference,{...patch,updatedAt:serverTimestamp()});
      } else {
        if (order.status==='Done') throw new Error('Reopen this order before adding a note.');
        if (!comment) throw new Error('Please enter a maintenance note.');
        if (order.comments?.some(c=>c.id===commentId)) return;
        tx.update(reference,{comments:[...(order.comments || []),comment],updatedAt:serverTimestamp()});
      }
    });
  });
}
