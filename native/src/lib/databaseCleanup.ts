import {getFunctions,httpsCallable} from 'firebase/functions';
import {app,auth} from './firebase';
import {readCleanupJob,type CleanupCategory,type CleanupJob} from '../profile/databaseCleanupModel';
export type CleanupRequest =
  | {action:'preview';categories:CleanupCategory[];requestId:string}
  | {action:'status'|'resume'|'cancel';jobId:string}
  | {action:'confirm';jobId:string;planHash:string;confirmation:string};
/** This callable owns inventory, authorization and deletion; the client never deletes records. */
export async function manageDatabaseCleanup(input:CleanupRequest):Promise<CleanupJob> {
  if(!auth.currentUser) throw Error('Sign in with an approved Admin account to use Database Cleanup.');
  try {
    const call=httpsCallable<CleanupRequest,unknown>(getFunctions(app,'us-central1'),'manageDatabaseCleanup',{timeout:30000});
    return readCleanupJob((await call(input)).data);
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
