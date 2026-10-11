/** Reserve the five-digit range so existing random four-digit tickets stay valid. */
export const FIRST_WORK_ORDER_NUMBER = 10000;
export function nextWorkOrderNumber(last: unknown): number {
  if (last === undefined) return FIRST_WORK_ORDER_NUMBER;
  if (
    typeof last !== "number" ||
    !Number.isSafeInteger(last) ||
    last < FIRST_WORK_ORDER_NUMBER ||
    last >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("The work order counter needs administrator attention.");
  }
  return last + 1;
}
export function workOrderCode(number: number): string {
  return `WO-${String(number).padStart(5, "0")}`;
}
