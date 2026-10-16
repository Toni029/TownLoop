import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
const request = httpsCallable(getFunctions(app, 'us-central1'), 'registerInboxDevice', { timeout: 15000 });
const pending = new Set<Promise<unknown>>();
let signingOut = false;
export async function registerDevice(data: { token: string; previousToken?: string | null; platform?: string; remove?: boolean }) {
  if (signingOut && !data.remove) throw Error('Signing out.');
  const work = request(data);
  pending.add(work);
  try { return await work; } finally { pending.delete(work); }
}
export async function beginPushSignOut() {
  signingOut = true;
  await Promise.allSettled([...pending]);
}
export function endPushSignOut() { signingOut = false; }
