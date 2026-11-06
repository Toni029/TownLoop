import {getFunctions,httpsCallable} from 'firebase/functions';
import {app,auth} from './firebase';
import {readCleanupJob,readCleanupScopePage,type CleanupCategory,type CleanupJob,type CleanupScopePage} from '../profile/databaseCleanupModel';
export type CleanupRequest =
  | {action:'preview';categories:CleanupCategory[];requestId:string}
  | {action:'status'|'resume'|'cancel';jobId:string}
  | {action:'confirm';jobId:string;planHash:string;confirmation:string};
type CleanupScopeRequest = {action:'scope';jobId:string;cursor?:string};
/** This callable owns inventory, authorization and deletion; the client never deletes records. */
export async function manageDatabaseCleanup(input:CleanupRequest):Promise<CleanupJob> {
  return readCleanupJob(await callCleanup(input));
}
export async function reviewDatabaseCleanupFiles(job:CleanupJob,cursor?:string):Promise<CleanupScopePage> {
  const input:CleanupScopeRequest={action:'scope',jobId:job.id,...(cursor?{cursor}:{})};
  return readCleanupScopePage(await callCleanup(input),job.categories);
}
async function callCleanup(input:CleanupRequest|CleanupScopeRequest):Promise<unknown> {
  if(!auth.currentUser) throw Error('Sign in with an approved Admin account to use Database Cleanup.');
  try {
    const call=httpsCallable<CleanupRequest|CleanupScopeRequest,unknown>(getFunctions(app,'us-central1'),'manageDatabaseCleanup',{timeout:30000});
    return (await call(input)).data;
  } catch(error) {
    const code=String((error as {code?:string})?.code || '');
    if(['functions/not-found','functions/unimplemented','functions/unavailable'].includes(code)) {
      throw Error('The Database Cleanup service is pending setup or temporarily unavailable. The last request could not be verified. Try again after the service is available; refresh any existing job status before continuing.');
    }
    if(code==='functions/permission-denied'||code==='functions/unauthenticated') {
      throw Error('Database Cleanup requires a currently approved Admin account. Refresh your session and try again.');
    }
    throw error instanceof Error ? error : Error('Unable to contact the cleanup service. Refresh status before trying again.');
  }
}
