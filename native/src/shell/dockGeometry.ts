type TabLayout = { x: number; width: number; contentWidth?: number };
export function dockBubble(tab: string, dockWidth: number, layout: TabLayout, neighbors: TabLayout[] = []) {
  const original = (dockWidth - 20) / 4 + (tab === 'workorders' ? 20 : 8);
  if (tab !== 'news') return { width: original, x: layout.x + (layout.width - original) / 2 };
  const center = layout.x + layout.width / 2;
  const content = layout.contentWidth ?? layout.width * .6;
  const padding = Math.max(0, layout.width - content) * .1;
  let width = Math.min(original, layout.width - padding * 2);
  for (const neighbor of neighbors) {
    const neighborCenter = neighbor.x + neighbor.width / 2;
    const nearEdge = Math.abs(neighborCenter - center) - (neighbor.contentWidth ?? neighbor.width) / 2;
    width = Math.min(width, Math.max(0, (nearEdge - padding) * 2));
  }
  return { width, x: center - width / 2 };
}
