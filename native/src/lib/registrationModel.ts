export function terminalRegistration(profile:Record<string,unknown>):boolean {
 return profile.registrationStatus==='denied'||profile.registrationStatus==='expired';
}
export function registrationRemaining(expiresAt:number|null,serverNow:number,legacy:boolean):string {
 if(legacy||expiresAt===null)return 'No automatic expiry · individual review required';
 const remaining=expiresAt-serverNow;
 if(remaining<=0)return 'Expiry reached · awaiting server cleanup';
 if(remaining<86400000)return `${Math.ceil(remaining/3600000)} hours remaining`;
 const days=Math.ceil(remaining/86400000);return `${days} day${days===1?'':'s'} remaining`;
}
export function registrationMessage(profile:Record<string,unknown>,now=Date.now()):string {
 const expiry=profile.registrationExpiresAt as {toMillis?:()=>number}|undefined;
 if(profile.registrationVersion===1&&profile.registrationStatus!=='approved'&&Number.isFinite(expiry?.toMillis?.())&&expiry!.toMillis!()<=now)return 'Your registration expired before approval. You can apply again after account cleanup finishes.';
 if(profile.registrationStatus==='denied')return 'Your registration was denied. Contact your community office for assistance. Reapplication is available after account cleanup and any restriction ends.';
 if(profile.registrationStatus==='expired')return 'Your registration expired before approval. You can apply again after account cleanup finishes.';
 if(profile.registrationVersion!==1)return 'Your registration requires individual review. It has no automatic expiry. Please contact your community office.';
 return 'Your community office must approve your account before you can enter TownLoop.';
}

export function registrationReminderSummary(items:{reminderStage?:'day7'|'day12'}[]):string|null {
 const day7=items.filter(item=>item.reminderStage==='day7').length;
 const day12=items.filter(item=>item.reminderStage==='day12').length;
 return day7||day12 ? `Approval reminders: ${day7} at day 7 · ${day12} at day 12. Review before their approval window ends.` : null;
}
