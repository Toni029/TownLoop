export function dockBubble(tab: string, dockWidth: number, layout: { x: number; width: number }) {
  const original = (dockWidth - 20) / 4 + (tab === 'workorders' ? 20 : 8);
  const width = tab === 'news' ? Math.min(original, Math.max(0, layout.width - 12)) : original;
  return { width, x: layout.x + (layout.width - width) / 2 };
}
