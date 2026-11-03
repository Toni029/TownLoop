const submission=/^comment_(\d{13})_[A-Za-z0-9_-]+$/;
/** Timestamp the first submission attempt; retries keep the same identity/date. */
export function commentSubmissionId(id:string,now=Date.now()):string {
  return submission.test(id)?id:`comment_${Math.floor(now)}_${id}`;
}
export function commentTime(comment:{id:string|number;createdAt?:number;timeAgo?:string},now=Date.now()):string {
  const encoded=String(comment.id).match(submission);
  const iso=typeof comment.timeAgo==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(comment.timeAgo)?Date.parse(comment.timeAgo):0;
  const date=comment.createdAt||Number(encoded?.[1])||iso;
  if (!Number.isFinite(date) || date <= 0 || date > 8640000000000000) return '';
  const calendarDay=(time:number)=>{const d=new Date(time);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());};
  const days=Math.max(0,Math.round((calendarDay(now)-calendarDay(date))/86400000));
  if(days===0)return 'today';
  if(days===1)return 'yesterday';
  if(days<7)return `${days} days ago`;
  if(days<30){const weeks=Math.floor(days/7);return weeks===1?'a week ago':`${weeks} weeks ago`;}
  if(days<365){const months=Math.floor(days/30);return months===1?'a month ago':`${months} months ago`;}
  const years=Math.floor(days/365);return years===1?'a year ago':`${years} years ago`;
}
