import {validDeletionConfirmation} from '../profile/deletionConfirmation';
import {clearPushAccount} from '../notifications/device';
import { clearPrivateMediaCache } from '../localData/privateMediaCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { createAccountCleanupQueue } from '../localData/accountCleanupQueue';
import { authPersistenceStorage, clearResidentHomeData } from '../localData/nativeStorage';
import { app, auth } from './firebase';
import { reauthenticateDeletionGoogle } from './accountDeletionGoogle';

export async function requestAccountDeletion(password: string, confirmation: string): Promise<{ jobId: string; status: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  if (!validDeletionConfirmation(confirmation)) throw new Error('Type DELETE to confirm.');
  const providers = user.providerData.map(provider => provider.providerId);
  if (providers.includes('password') && user.email && password) {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else if (providers.includes('google.com')) {
    await reauthenticateDeletionGoogle();
  } else if (providers.includes('password')) {
    throw new Error('Enter your password to verify your identity.');
  } else {
    throw new Error('This sign-in provider needs a supported reauthentication flow before deletion.');
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your session changed. Sign in again.');
  await user.getIdToken(true);
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your session changed. Sign in again.');
  const request = httpsCallable<{ confirmation: string; requestOnly: boolean }, { jobId: string; status: string }>(getFunctions(app, 'us-central1'), 'submitAccountDeletionRequest');
  return (await request({ confirmation: 'DELETE', requestOnly: true })).data;
}

/** Exact account-scoped keys only; never clear another account's data or all AsyncStorage. */
async function clearAccountFiles(uid: string): Promise<void> {
  await clearResidentHomeData(uid);
  await clearPrivateMediaCache(uid);
  await AsyncStorage.multiRemove([`townloop:social:liked:${uid}`]);
  await clearPushAccount(uid);
}

const cleanupQueue = createAccountCleanupQueue(authPersistenceStorage, clearAccountFiles, async uid => {
  if (auth.currentUser?.uid === uid) await signOut(auth);
});
export const clearDeletedAccountCaches = (uid: string) => cleanupQueue.enqueue(uid);
export const retryPendingAccountCleanup = async () => {
  await cleanupQueue.retry();
};

export type {DeletionRequestStatus} from './deletionStatus';
import type {DeletionRequestStatus} from './deletionStatus';
export {deletionStatusText} from './deletionStatus';
export type DeletionReviewItem = DeletionRequestStatus & { jobId: string; name: string; canReview: boolean; isOwnRequest: boolean };
const deletionCall = <T, R>(name: string, data: T) => httpsCallable<T, R>(getFunctions(app, 'us-central1'), name)(data).then(result => result.data);
export const getAccountDeletionStatus = () => deletionCall<Record<string, never>, DeletionRequestStatus>('getAccountDeletionStatus', {});
export const listAccountDeletionRequests = (cursor?: string) => deletionCall<{cursor?: string}, { requests: DeletionReviewItem[]; policyReady: boolean; exceptionsAvailable?:boolean; processingAvailable?:boolean; nextCursor: string | null }>('listAccountDeletionRequests', cursor ? {cursor} : {});
export const reviewAccountDeletionRequest = (jobId: string, decision: 'approved' | 'rejected' | 'delayed', reason: string, context?: {reasonCategory?:string;reasonReference?:string;delayUntil?:number}) =>
  deletionCall<Record<string,unknown>,{jobId:string;status:string}>('reviewAccountDeletionRequest', { jobId, decision, reason, confirmation: decision, ...context });
