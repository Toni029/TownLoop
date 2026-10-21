import {localDate} from './model.ts';
/** Device-local schedule; no wake-up setting currently exists, so morning starts at 06:00. */
export function headerTime(now: Date) {
  const hour=now.getHours();
  const greeting=hour<6 || hour>=21 ? 'Good Night' : hour<12 ? 'Good Morning' : hour<17 ? 'Good Afternoon' : 'Good Evening';
  const next=[6,12,17,21,24].map(h=>{const date=new Date(now);date.setHours(h,0,0,0);return date.getTime();}).find(t=>t>now.getTime())!;
  return {today:localDate(now),greeting,next};
}
