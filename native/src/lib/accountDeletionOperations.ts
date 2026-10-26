import {getFunctions,httpsCallable} from 'firebase/functions';
import {app} from './firebase';
const call=<T,R>(name:string,data:T)=>httpsCallable<T,R>(getFunctions(app,'us-central1'),name)(data).then(result=>result.data);
export const deletionScopes=[{label:'App records',id:'(default)'},{label:'Website records',id:'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb'}];
export type DeletionException={id:string;collection:string;recordId?:string;reason:string};
export const deletionExceptions=(jobId:string,databaseId:string,cursor?:string)=>call<{jobId:string;databaseId:string;cursor?:string},{summary?:string;exceptions:DeletionException[];nextCursor:string|null}>('listAccountDeletionExceptions',{jobId,databaseId,...(cursor?{cursor}:{})});

export const recheckDeletionException=(jobId:string,databaseId:string,receiptId:string)=>call('recheckAccountDeletionException',{jobId,databaseId,receiptId,confirmation:'RECHECK'});
export const authorizeDeletionProcessing=(jobId:string)=>call('authorizeAccountDeletionProcessing',{jobId,confirmation:'AUTHORIZE PROCESSING'});

export const recheckDeletionScope=(jobId:string)=>call('recheckAccountDeletionScope',{jobId,confirmation:'RECHECK'});
