/** Friendly client feedback only; Firestore/backend remain authoritative. */
export function socialRetentionBlocked(data:Record<string,unknown>,now=Date.now()):boolean {
 for(const key of ['legalHold','evidenceHold','retentionHold','hold','reported'])if(data[key]!=null&&data[key]!==false)return true;
 if(data.holds&&Object.keys(data.holds as object).length||data.evidence||data.reportId||Array.isArray(data.reportIds)&&data.reportIds.length||data.retention&&data.retention!==false||data.retentionVersion!=null)return true;
 for(const key of ['retainUntil','retentionUntil','deleteAfter','retentionDueAt','retentionExpiresAt'])if(data[key]!=null){const time=(data[key] as {toMillis?:()=>number}).toMillis?.();if(!Number.isFinite(time)||time!>now)return true;}
 return false;
}
