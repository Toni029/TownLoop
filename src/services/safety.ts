import { getFunctions, httpsCallable } from 'firebase/functions';
import type { FirebaseApp } from 'firebase/app';
export type SafetyTarget = {kind: 'post' | 'listing' | 'comment' | 'user'; id: string; collection?: string; commentId?: string; authorId?: string};
export async function submitSafetyReport(app: FirebaseApp, target: SafetyTarget, reason: string, details: string) {
  return httpsCallable(getFunctions(app, 'us-central1'), 'submitSafetyReport')({ ...target, reason, details });
}
export async function setUserBlock(app: FirebaseApp, targetUid: string, blocked: boolean) {
  return httpsCallable(getFunctions(app, 'us-central1'), 'setUserBlock')({ targetUid, blocked });
}
export async function reviewSafetyReport(app: FirebaseApp, reportId: string, action: string, note: string) {
  return httpsCallable(getFunctions(app, 'us-central1'), 'reviewSafetyReport')({ reportId, action, note });
}
