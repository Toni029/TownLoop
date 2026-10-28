/** Normalize only the confirmation word, never identity or authorization data. */
export const validDeletionConfirmation=(value:unknown):boolean=>typeof value==='string'&&value.trim().toLowerCase()==='delete';
