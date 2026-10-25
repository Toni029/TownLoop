import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { clearResidentHomeData } from '../localData/nativeStorage';
import { app, auth } from './firebase';
import { reauthenticateDeletionGoogle } from './accountDeletionGoogle';

export async function requestAccountDeletion(password: string, confirmation: string): Promise<{ jobId: string; status: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  if (confirmation !== 'DELETE') throw new Error('Type DELETE exactly to confirm.');
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
  return (await request({ confirmation, requestOnly: true })).data;
}

/** Exact account-scoped keys only; never clear another account's data or all AsyncStorage. */
export async function clearDeletedAccountCaches(uid: string): Promise<void> {
  await clearResidentHomeData(uid);
  await AsyncStorage.multiRemove([`townloop:social:liked:${uid}`]);
}

export type DeletionRequestStatus = { status: string; jobId?: string; createdAt?: number | null; reviewedAt?: number | null; reason?: string; processingHeld?: boolean; reviewDueAt?: number; escalateAt?: number; retentionDueAt?: number; completionDueAt?: number | null; reviewOverdue?: boolean; escalated?: boolean; processingOverdue?: boolean; retentionOverdue?: boolean };
export type DeletionReviewItem = DeletionRequestStatus & { jobId: string; name: string; canReview: boolean; isOwnRequest: boolean };
const deletionCall = <T, R>(name: string, data: T) => httpsCallable<T, R>(getFunctions(app, 'us-central1'), name)(data).then(result => result.data);
export const getAccountDeletionStatus = () => deletionCall<Record<string, never>, DeletionRequestStatus>('getAccountDeletionStatus', {});
export const listAccountDeletionRequests = (cursor?: string) => deletionCall<{cursor?: string}, { requests: DeletionReviewItem[]; policyReady: boolean; nextCursor: string | null }>('listAccountDeletionRequests', cursor ? {cursor} : {});
export const reviewAccountDeletionRequest = (jobId: string, decision: 'approved' | 'rejected' | 'delayed', reason: string, context?: {reasonCategory?:string;reasonReference?:string;delayUntil?:number}) =>
  deletionCall('reviewAccountDeletionRequest', { jobId, decision, reason, confirmation: decision, ...context });
export function deletionStatusText(request: DeletionRequestStatus): string {
  const labels: Record<string, string> = {
    delayed:'Request delayed for a documented legal/security reason; original deadlines remain in effect.', needs_review:'Processing needs office review; unresolved items have not been marked complete.', failed:'Processing interrupted; a retry is pending.', retention_pending:'Personal-data processing completed; minimal receipts await scheduled expiry.', none: 'No deletion request submitted.', requested: 'Awaiting Admin/VIP review.',
    approved_held: 'Approved. Deletion processing remains on hold.',
    queued: 'Approved. Awaiting authorized processing.', processing: 'Deletion processing is in progress.',
    pending_owner_approval: 'Awaiting an approved retention policy.',
    identity_complete_media_pending: 'Account removed; associated media cleanup is pending.',
    complete: 'Deletion processing completed under the approved retention policy.',
    rejected: 'Request closed after documented withdrawal. Contact the office if this is incorrect.',
  };
  return labels[request.status] || 'Request requires office review.';
}
