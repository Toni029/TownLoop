export const CLEANUP_CATEGORIES = [
  {key:'workOrders', label:'All Work Orders'},
  {key:'discussion', label:'All Discussion Feed Posts'},
  {key:'marketplace', label:'All Marketplace Listings'},
  {key:'newsletters', label:'All Newsletters, including their RSVP Events and Pinned Highlights'},
] as const;
export type CleanupCategory = typeof CLEANUP_CATEGORIES[number]['key'];
export type CleanupState = 'planning'|'review'|'queued'|'running'|'paused'|'completed'|'completed_with_holds'|'failed'|'cancelled';
export type CleanupCount = {records:number;documents:number;deleted:number;held:number;failed:number;remaining:number;storageDeleted:number;storageHeld:number};
export type CleanupJob = {
  id:string;state:CleanupState;categories:CleanupCategory[];counts:Partial<Record<CleanupCategory,CleanupCount>>;
  planHash?:string;confirmationPhrase:'DELETE SELECTED DATA';enabled:boolean;completeInventory:boolean;message?:string;
};
export const CLEANUP_PHRASE = 'DELETE SELECTED DATA';
export function canUseDatabaseCleanup(user: {role?:string;approved?:boolean;deletionPending?:boolean}|null|undefined) {
  return user?.role === 'admin' && user.approved === true && user.deletionPending !== true;
}
export function toggleCleanupCategory(selected:CleanupCategory[], key:CleanupCategory):CleanupCategory[] {
  const next = new Set(selected);
  if(next.has(key))next.delete(key);else next.add(key);
  return CLEANUP_CATEGORIES.map(category=>category.key).filter(category=>next.has(category));
}
export function canConfirmCleanup(job:CleanupJob|null,phrase:string,busy:boolean) {
  return !busy && !!job && job.state==='review' && job.enabled && job.completeInventory && !!job.planHash && phrase===CLEANUP_PHRASE;
}
export function cleanupIsActive(job:CleanupJob|null) {
  return !!job && ['planning','queued','running'].includes(job.state);
}
export function cleanupCanCancel(job:CleanupJob|null) {
  return !!job && !['completed','completed_with_holds','cancelled'].includes(job.state);
}
export function cleanupOutcome(job:CleanupJob) {
  switch(job.state) {
    case 'planning': return 'Preparing the inventory. No data is deleted during preview.';
    case 'review': return 'Inventory ready. Review the selected categories before confirming.';
    case 'queued': return 'Cleanup is queued. The server will process the confirmed inventory.';
    case 'running': return 'Cleanup is in progress. Progress includes protected records that must remain.';
    case 'paused': return 'Cleanup is paused. Review the details before choosing Resume.';
    case 'failed': return 'Cleanup failed. Some data may already be deleted. Check status before resuming.';
    case 'completed': return 'Cleanup completed for the confirmed inventory.';
    case 'completed_with_holds': return 'Cleanup finished with holds. Protected records or files remain; the selected data was not fully deleted.';
    case 'cancelled': return 'Cleanup cancelled. Data already deleted cannot be restored.';
  }
}
/** Treat incomplete or unrecognized callable responses as unavailable, never as an approved plan. */
export function readCleanupJob(value:unknown):CleanupJob {
  const job=value as CleanupJob;
  const keys=CLEANUP_CATEGORIES.map(category=>category.key);
  const states:CleanupState[]=['planning','review','queued','running','paused','completed','completed_with_holds','failed','cancelled'];
  const invalid=()=>{throw Error('Unable to verify the cleanup service response. Refresh the job status before continuing.');};
  if(!job || typeof job!=='object' || typeof job.id!=='string' || !job.id || !states.includes(job.state)
    || !Array.isArray(job.categories) || !job.categories.length || new Set(job.categories).size!==job.categories.length
    || !job.categories.every(key=>keys.includes(key)) || typeof job.enabled!=='boolean' || typeof job.completeInventory!=='boolean'
    || job.confirmationPhrase!==CLEANUP_PHRASE || !job.counts || typeof job.counts!=='object'
    || (job.planHash!==undefined && (typeof job.planHash!=='string' || !job.planHash))
    || (job.message!==undefined && typeof job.message!=='string')) return invalid();
  for(const key of job.categories) {
    const count=job.counts[key];
    if(!count || !['records','documents','deleted','held','failed','remaining','storageDeleted','storageHeld'].every(field=>Number.isSafeInteger(count[field as keyof CleanupCount]) && count[field as keyof CleanupCount]>=0)) return invalid();
  }
  return job;
}
