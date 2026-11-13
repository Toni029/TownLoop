// Each database uses its own control document as the reference-write fence.
// Cross-database cleanup acquires and verifies every relevant database barrier
// before scanning or deleting. Never substitute another database for this db.
// Read it in the SAME transaction as every media-bearing write, before any write:
// an in-flight writer then conflicts with acquisition of the cleanup barrier.
const REFERENCE_WRITE_CONTROL = 'database_cleanup_control/active';
const REFERENCE_WRITE_MAINTENANCE_MESSAGE = 'Community data maintenance is in progress. Please try again after maintenance finishes.';
function maintenanceError(message) {
  return Object.assign(new Error('failed-precondition'), {
    code: 'failed-precondition', safeReason: 'database-cleanup-maintenance', safeMessage: message,
  });
}
/** @param {any} transaction @param {any} db @param {(message: string) => Error} [errorFactory] */
async function assertReferenceWritesAllowed(transaction, db, errorFactory = maintenanceError) {
  const control = await transaction.get(db.doc(REFERENCE_WRITE_CONTROL));
  if (control.data()?.referenceWritesBlocked === true) throw errorFactory(REFERENCE_WRITE_MAINTENANCE_MESSAGE);
}
module.exports = { assertReferenceWritesAllowed, REFERENCE_WRITE_CONTROL, REFERENCE_WRITE_MAINTENANCE_MESSAGE };
