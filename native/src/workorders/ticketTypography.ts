export function ticketTypography(code: string) {
  const digits = /^WO-(\d+)$/i.exec(code)?.[1] || code;
  return { text: digits, fontSize: Math.max(6, Math.min(18, 51.6 / (0.72 * Math.max(1, digits.length)))), lineHeight: 22, scaleY: 1.25 };
}
