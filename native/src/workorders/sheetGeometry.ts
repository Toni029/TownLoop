/** Stable viewport snap points; form content never participates in sheet geometry. */
export function sheetStops(height: number, topInset: number) {
  const viewport = Math.max(1, height);
  const full = Math.min(Math.max(0, topInset), Math.max(0, viewport - 1));
  return { full, half: Math.max(full, viewport * 0.46), hidden: viewport + 24 };
}
export function sheetDestination(y: number, velocity: number, full: number, half: number) {
  'worklet';
  if (velocity < -800) return 'full';
  const projected = y + velocity * 0.16;
  if (projected > half + 90 && velocity >= 0) return 'close';
  return projected < (full + half) / 2 ? 'full' : 'half';
}
