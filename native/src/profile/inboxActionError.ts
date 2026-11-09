export function isLegacyReview(error:unknown){
 const value=error as {code?:string;message?:string;details?:{reason?:string}};
 return value?.code?.split('/').at(-1)==='failed-precondition'&&(value.details?.reason==='legacy-review'||/older conversation|historical membership/i.test(value.message||''));
}
/** Keep callable codes/details for recovery, but never expose raw HTTP status suffixes. */
export function inboxActionError(error:unknown):Error {
 const value=error as {code?:string;message?:string;details?:unknown},code=value?.code?.split('/').at(-1);
 const message=isLegacyReview(error)?'This older conversation’s history remains protected. Start a new conversation to send new messages without sharing earlier history.':
 code==='invalid-argument'?'The Inbox service could not accept this message request. Refresh Inbox and retry. Your draft has been kept.':
 code==='permission-denied'?'You no longer have permission to use this conversation. Refresh Inbox to check your access.':
 code==='unauthenticated'?'Please sign in again before sending messages.':
 code==='failed-precondition'?'This conversation is read-only or its participants are no longer available.':
 ['unavailable','deadline-exceeded'].includes(code||'')?'Could not confirm the Inbox action. Reconnect and retry; your draft has been kept.':
 (value?.message||'Unable to complete the Inbox action.').replace(/\s*\[\d{3}\]\s*$/,'');
 return Object.assign(Error(message),{code:value?.code,details:value?.details,legacyReview:isLegacyReview(error)});
}
