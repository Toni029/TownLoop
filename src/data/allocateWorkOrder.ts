import { doc, getDoc, runTransaction, type Firestore, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { nextWorkOrderNumber, workOrderCode } from './workOrderNumber';

// This database currently serves Cecil Pines. Do not scope by resident or device.
// Immutable reservations survive ticket deletion and reserve historical four-digit codes.
export async function allocateWorkOrder(db: Firestore, reference: DocumentReference, payload: DocumentData): Promise<void> {
  const counter = doc(db, 'counters', 'work_orders_four_digit');
  for (let skipped = 0; skipped < 32; skipped++) {
    let observed: unknown;
    let saved: boolean;
    try {
    saved = await runTransaction(db, async transaction => {
      if ((await transaction.get(reference)).exists()) return true;
      const state = await transaction.get(counter);
      if (!state.exists() || state.data()?.ready !== true)
        throw new Error('Ticket numbering is being prepared. Please try again shortly.');
      observed = state.data()?.lastNumber;
      const number = nextWorkOrderNumber(observed);
      const reservation = doc(db, 'work_order_numbers', String(number));
      if ((await transaction.get(reservation)).exists()) {
        transaction.update(counter, { lastNumber: number, orderId: '' });
        return false;
      }
      transaction.set(reference, { ...payload, ticketNumber: number, code: workOrderCode(number) });
      transaction.set(reservation, { orderId: reference.id });
      transaction.update(counter, { lastNumber: number, orderId: reference.id });
      return true;
    });
    } catch (error) {
      // A competing commit can make strict increment rules reject a stale
      // transaction before the SDK reports ABORTED. Retry only with evidence
      // that the shared counter actually moved; never mask a permission failure.
      if ((error as { code?: string }).code === 'permission-denied' && typeof observed === 'number') {
        const latest = await getDoc(counter);
        if (latest.data()?.ready === true && latest.data()?.lastNumber > observed) continue;
      }
      throw error;
    }
    if (saved) return;
  }
  throw new Error('Historical ticket numbers were reserved. Please retry your submission; your draft has not been submitted.');
}
