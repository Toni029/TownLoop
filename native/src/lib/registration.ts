import {getFunctions, httpsCallable} from 'firebase/functions';
import {TERMS_VERSION} from '../../../src/data/legal';
import {friendlyError} from './profile';
import {app, auth} from './firebase';
export type RegistrationInput = {name:string; address:string; phone:string; emergencyContactName:string; emergencyContactPhone:string; emergencyContactAddress:string; avatarUrl?:string; termsAccepted:true};
export type RegistrationResult = {status:'pending'|'approved'|'legacy_pending'; submittedAt:number|null; expiresAt:number|null; created:boolean};
export type PendingRegistration = {uid:string; name:string; email:string; status:string; submittedAt:number|null; expiresAt:number|null; legacy:boolean; reminderStage?:'day7'|'day12'};
export type RegistrationRestriction = {id:string; reason:string; deniedAt:number; expiresAt:number};
export type PendingRegistrations = {items:PendingRegistration[]; serverNow:number; cleanupPendingCount?:number; cleanupNeedsReviewCount?:number; hasMore?:boolean; next?:string|null};
export type RegistrationRestrictions = {items:RegistrationRestriction[]; serverNow:number; next?:{id:string;expiresAt:number}|null};
export type DenialReason = 'incomplete'|'residency'|'duplicate'|'other'|'spam'|'fraud'|'abuse'|'circumvention';
type LifecycleAction = {action:'listPending';after?:string} | {action:'listRestrictions';after?:{id:string;expiresAt:number}} | {action:'approve';uid:string} | {action:'deny';uid:string;category:'ordinary'|'abuse';reason:DenialReason;confirmed:true} | {action:'liftRestriction';restrictionId:string;reason:string;confirmed:true};
export async function submitResidentRegistration(input:RegistrationInput):Promise<RegistrationResult> {
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sign in again before submitting your registration.');
 const {data}=await httpsCallable<RegistrationInput & {termsVersion:string;expectedUid:string},RegistrationResult>(getFunctions(app,'us-central1'),'submitResidentRegistration')({...input,termsVersion:TERMS_VERSION,expectedUid:uid});
 if(auth.currentUser?.uid!==uid)throw Error('Your account changed. Sign in again before continuing.');
 if(!data||!['pending','approved','legacy_pending'].includes(data.status)||typeof data.created!=='boolean')throw Error('Registration service returned an unexpected response. Please try again.');
 return data;
}
export async function manageRegistrationLifecycle<T=unknown>(input:LifecycleAction):Promise<T> {
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sign in again before continuing.');
 const {data}=await httpsCallable<LifecycleAction & {expectedUid:string},T>(getFunctions(app,'us-central1'),'manageRegistrationLifecycle')({...input,expectedUid:uid});
 if(auth.currentUser?.uid!==uid)throw Error('Your account changed. Reopen registration review.');
 if(input.action==='listPending'||input.action==='listRestrictions') {
  const list=data as PendingRegistrations;
  if(!list||!Array.isArray(list.items)||!Number.isFinite(list.serverNow))throw Error('Registration review service returned an unexpected response. Please retry.');
 }
 return data;
}
export function registrationError(error:unknown):string {
 const code=(error as {code?:string})?.code;
 if(code?.startsWith('auth/'))return friendlyError(error);
 if(code==='functions/not-found'||code==='functions/unimplemented')return 'The registration service is unavailable. Please contact your community office and try again later.';
 if(code==='functions/permission-denied')return 'This registration request cannot be completed. Please contact your community office.';
 return error instanceof Error ? error.message : 'Unable to complete registration. Please try again.';
}
