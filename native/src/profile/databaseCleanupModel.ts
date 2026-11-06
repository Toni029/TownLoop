export const CLEANUP_CATEGORIES = [
  {key:'workOrders', label:'All Work Orders'},
  {key:'discussion', label:'All Discussion Feed Posts'},
  {key:'marketplace', label:'All Marketplace Listings'},
  {key:'newsletters', label:'All Newsletters, including their RSVP Events and Pinned Highlights'},
] as const;
export type CleanupCategory = typeof CLEANUP_CATEGORIES[number]['key'];
export type CleanupState = 'planning'|'review'|'queued'|'running'|'paused'|'completed'|'completed_with_holds'|'failed'|'cancelled';
export type CleanupCount = {records:number;documents:number;deleted:number;held:number;failed:number;remaining:number;storageDeleted:number;storageHeld:number};
export type CleanupStorageScope = {files:number;bytes:number;exclusive:number;held:number;missing:number;remaining:number;reasons:{code:string;count:number}[]};
export type CleanupScopeItem = {path:string;category:CleanupCategory;status:'exclusive'|'held'|'missing'|'deleted';bytes:number;reason?:string;generation?:string};
export type CleanupScopePage = {items:CleanupScopeItem[];nextCursor?:string};
export type CleanupJob = {
  readOnly?:boolean;filePage?:CleanupScopePage;
  id:string;state:CleanupState;categories:CleanupCategory[];counts:Partial<Record<CleanupCategory,CleanupCount>>;
  storageScope?:Partial<Record<CleanupCategory,CleanupStorageScope>>;
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
  return !!job && !job.readOnly && !['completed','completed_with_holds','cancelled'].includes(job.state);
}
export function cleanupOutcome(job:CleanupJob) {
  if(job.readOnly)return 'Read-only inventory · deletion disabled';
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
  if(job.storageScope!==undefined) {
    if(!job.storageScope || typeof job.storageScope!=='object' || Array.isArray(job.storageScope))return invalid();
    for(const [key,scope] of Object.entries(job.storageScope)) {
      if(!job.categories.includes(key as CleanupCategory) || !scope || typeof scope!=='object'
        || !['files','bytes','exclusive','held','missing','remaining'].every(field=>Number.isSafeInteger(scope[field as keyof Omit<CleanupStorageScope,'reasons'>]) && (scope[field as keyof Omit<CleanupStorageScope,'reasons'>] as number)>=0)
        || !Array.isArray(scope.reasons) || !scope.reasons.every(reason=>reason && typeof reason.code==='string' && /^[a-z_]+$/.test(reason.code) && Number.isSafeInteger(reason.count) && reason.count>=0))return invalid();
    }
  }
  if(job.readOnly!==undefined&&job.readOnly!==true)return invalid();
  if(job.readOnly&&(job.enabled||job.state!=='review'||job.planHash))return invalid();
  if(job.filePage!==undefined)readCleanupScopePage(job.filePage,job.categories);
  return job;
}
export function cleanupStorageReason(code:string):string {
  const reasons:Record<string,string>={
    read_only_execution_disabled:'Ownership metadata matches; exclusivity is not certified in read-only mode',shared_reference:'Shared with another record',metadata_missing:'Object metadata is missing',ownership_unverified:'Ownership could not be verified',
    protected_record:'Referenced by protected data',reference_writers_unfenced:'Reference writers are not yet fenced; file deletion is blocked',
    object_changed:'Object changed after inventory',inventory_incomplete:'Inventory is incomplete',active_analysis:'Analysis is still active',
    newsletter_storage_unverified:'Newsletter file ownership is unverified',file_missing:'File is missing',
  };
  return Object.hasOwn(reasons,code)?reasons[code]:'File retained for an unrecognized safety reason';
}
/** Scope pages are read-only and must never be interpreted as cleanup jobs or authorization. */
export function readCleanupScopePage(value:unknown,categories:CleanupCategory[]):CleanupScopePage {
  const page=value as CleanupScopePage;
  const invalid=()=>{throw Error('Unable to verify the file review. Refresh the job status before continuing.');};
  if(!page || typeof page!=='object' || !Array.isArray(page.items) || page.items.length>100
    || (page.nextCursor!==undefined && (typeof page.nextCursor!=='string' || !page.nextCursor || page.nextCursor.length>2048)))return invalid();
  for(const item of page.items) {
    if(!item || !categories.includes(item.category) || !['exclusive','held','missing','deleted'].includes(item.status)
      || typeof item.path!=='string' || !item.path || item.path.length>1024 || /[?#\\\x00-\x1f\x7f]/.test(item.path)
      || item.path.includes('://') || item.path.startsWith('/') || item.path.split('/').some(part=>!part || part==='.' || part==='..')
      || /%(?:25|3f|23|00|0a|0d)/i.test(item.path)
      || !Number.isSafeInteger(item.bytes) || item.bytes<0
      || (item.generation!==undefined&&(typeof item.generation!=='string'||!/^\d+$/.test(item.generation))) || (item.reason!==undefined && (typeof item.reason!=='string' || !/^[a-z_]+$/.test(item.reason))))return invalid();
  }
  return page;
}
