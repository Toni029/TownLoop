const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
function protectedOrder(data, now) {
  if (['legalHold', 'evidenceHold', 'retentionHold', 'hold', 'holds', 'retention', 'evidence', 'reported', 'reportId']
    .some(key => data[key] && data[key] !== false) || data.reportIds?.length) return true;
  for (const key of ['retainUntil', 'retentionUntil', 'deleteAfter', 'retentionDueAt', 'retentionExpiresAt']) {
    const value = data[key];
    if (value == null || value === false) continue;
    const time = value.toMillis?.() ?? new Date(value).getTime();
    if (!Number.isFinite(time) || time > now) return true;
  }
  return false;
}
function eligible(data, now) {
  return data?.status === 'Done' && data.retentionVersion === 1 &&
    typeof data.completedAt?.toMillis === 'function' &&
    data.completedAt.toMillis() <= now - RETENTION_MS &&
    !protectedOrder(data, now);
}
async function deleteIfExpired(db, reference, now) {
  return db.runTransaction(async tx => {
    const current = await tx.get(reference);
    if (!current.exists || !eligible(current.data(), now)) return false;
    const control = (await tx.get(db.doc('database_cleanup_control/active'))).data();
    if (control?.accountDeletionOwner || control?.referenceWritesBlocked === true || control?.collections?.includes('work_orders')) return false;
    const reports = await tx.get(db.collection('moderation_reports').where('collection', '==', 'work_orders').where('id', '==', reference.id).limit(1));
    if (!reports.empty) return false;
    tx.delete(reference);
    return true;
  });
}
module.exports = { RETENTION_MS, eligible, deleteIfExpired };
