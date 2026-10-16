const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
function eligible(data, now) {
  return data?.status === 'Done' && data.retentionVersion === 1 &&
    typeof data.completedAt?.toMillis === 'function' &&
    data.completedAt.toMillis() <= now - RETENTION_MS;
}
async function deleteIfExpired(db, reference, now) {
  return db.runTransaction(async tx => {
    const current = await tx.get(reference);
    if (!current.exists || !eligible(current.data(), now)) return false;
    tx.delete(reference);
    return true;
  });
}
module.exports = { RETENTION_MS, eligible, deleteIfExpired };
