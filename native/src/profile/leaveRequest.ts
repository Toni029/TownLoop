import type { Thread } from './model';
const sources = {friend:'resident_chats',office:'office_chats',maintenance:'maintenance_chats'};
export function inboxFailureMessage(error: unknown, action: 'leave' | 'read'): string {
  const value=error as {code?:string;message?:string};
  const code=value?.code?.split('/').at(-1);
  if(code==='unauthenticated')return 'Please sign in again before using the Inbox.';
  if(code==='permission-denied')return action==='leave'
    ? 'You do not currently have permission to leave this conversation. Nothing was removed. The community office may need to finish the Inbox service update.'
    : 'Inbox access was denied. The matching Inbox backend and security rules may still need to be deployed. Please contact the community office.';
  if(['not-found','unimplemented'].includes(code||''))return 'Individual conversation leaving requires the Inbox backend update. Nothing was removed.';
  if(code==='failed-precondition')return value.message?.includes('older conversation')
    ? 'This older conversation needs verified participant review by the community office before you can leave safely. Nothing was removed.'
    : 'Individual conversation leaving is not active yet. The Inbox backend update must be completed first. Nothing was removed.';
  if(['unavailable','deadline-exceeded','network-request-failed'].includes(code||''))return 'Could not confirm that you left the conversation. Please reconnect and try again.';
  return action==='leave' ? 'Could not confirm that you left the conversation. Please try again.' : 'Unable to load the Inbox. Please reconnect and retry.';
}
/** No optimistic removal: callers may change navigation only after this resolves. */
export async function leaveInboxConversation(
  thread: Pick<Thread,'id'|'category'|'data'>,
  invoke: (op:string,input:Record<string,unknown>)=>Promise<unknown>,
):Promise<void> {
  try {
    const response=await (thread.data.schemaVersion===3
      ? invoke('leave',{conversationId:thread.id})
      : invoke('leaveLegacy',{source:sources[thread.category],legacyId:thread.id}));
    if((response as {left?:boolean})?.left!==true)throw Error('leave_not_confirmed');
  } catch(error) { throw Error(inboxFailureMessage(error,'leave')); }
}
