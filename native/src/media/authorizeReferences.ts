import {getFunctions,httpsCallable} from 'firebase/functions';
import {app,auth} from '../lib/firebase';
import type {MediaAttachment} from '../../../src/types';
export async function authorizeReferences(collection:'marketplace_posts'|'discussion_feed'|'work_orders',recordId:string,selection:{media?:MediaAttachment[];photos?:string[];photo?:string}) {
 if(!(selection.media?.length||selection.photos?.length||selection.photo))return;
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Please sign in again.');
 await httpsCallable(getFunctions(app,'us-central1'),'issueMediaUpload')({action:'authorizeReferences',collection,recordId,...selection});
 if(auth.currentUser?.uid!==uid)throw Error('Your account changed. Please retry.');
}
