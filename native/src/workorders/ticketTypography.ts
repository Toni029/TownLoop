import { displayWorkOrderCode } from '../../../src/data/workOrderNumber.ts';
export function ticketTypography(code: string) {
  const digits = displayWorkOrderCode(code);
  return { text: digits, fontSize: Math.max(4, Math.min(18, 51.6 / (0.72 * Math.max(1, digits.length)))), lineHeight: 18, scaleY: 1.5 };
}
