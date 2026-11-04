import {getFunctions, httpsCallable} from 'firebase/functions';
import {doc, runTransaction, serverTimestamp} from 'firebase/firestore';
import {app, db} from '../lib/firebase';
import {approvedUser} from './actions';
import {pdfId} from './firestorePdf';
export async function discardNewsletterDraft(id: string) {
    await approvedUser(true);
    pdfId(id);
    try {
        const result = await httpsCallable<{newsletterId:string},{purged:boolean;pending?:boolean}>(getFunctions(app,'us-central1'),'discardNewsletterDraft',{timeout:60000})({newsletterId:id});
        if (!result.data.purged) throw Error('Discard is still processing. Retry; the published newsletter is unchanged.');
    } catch (error) {
        if (['functions/not-found','functions/unimplemented'].includes((error as {code?:string})?.code || '')) throw Error('Discard requires the newsletter cleanup backend update. Nothing was removed.');
        throw error;
    }
}
/** A server timestamp/updateTime keeps an actively reviewed draft out of the 24h sweep. */
export async function touchNewsletterDraft(id: string) {
    await approvedUser(true);
    pdfId(id);
    await runTransaction(db,async tx=>{
        const ref=doc(db,'newsletters',id),snapshot=await tx.get(ref);
        if (!snapshot.exists()) return; // Never invent a parent for a legacy orphan.
        if (!['uploading','uploaded'].includes(snapshot.data().uploadState)) throw Error('This PDF is no longer an active upload. Return to News.');
        tx.update(ref,{draftActivityAt:serverTimestamp()});
    });
}
