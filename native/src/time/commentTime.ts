import {relativePostedTime} from './relativePostedTime.ts';
const submission=/^comment_(\d{13})_[A-Za-z0-9_-]+$/;
/** Timestamp the first submission attempt; retries keep the same identity/date. */
export function commentSubmissionId(id:string,now=Date.now()):string {
  return submission.test(id)?id:`comment_${Math.floor(now)}_${id}`;
}
export function commentTime(comment:{id:string|number;createdAt?:number;timeAgo?:string},now=Date.now()):string {
  const encoded=String(comment.id).match(submission);
  const iso=typeof comment.timeAgo==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(comment.timeAgo)?Date.parse(comment.timeAgo):0;
  const date=comment.createdAt||Number(encoded?.[1])||iso;
  return relativePostedTime(date,now,'Just now').replace(/^Posted /,'');
}
