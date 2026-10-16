export const FIRST_WORK_ORDER_NUMBER = 1000;
export const LAST_WORK_ORDER_NUMBER = 9999;
export function nextWorkOrderNumber(last: unknown): number {
  if (typeof last !== 'number' || !Number.isSafeInteger(last) || last < 999 || last > LAST_WORK_ORDER_NUMBER)
    throw new Error('The work order counter needs administrator attention.');
  if (last === LAST_WORK_ORDER_NUMBER)
    throw new Error('All four-digit ticket numbers have been used. Please contact the office; no number will be reused.');
  return last + 1;
}
export function workOrderCode(number: number): string {
  if (!Number.isInteger(number) || number < FIRST_WORK_ORDER_NUMBER || number > LAST_WORK_ORDER_NUMBER)
    throw new Error('Invalid four-digit ticket number.');
  return String(number);
}
