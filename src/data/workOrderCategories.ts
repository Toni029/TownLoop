/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
export interface WorkOrderCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const WORK_ORDER_CATEGORIES: WorkOrderCategory[] = [
  {
    id: 'plumbing',
    emoji: '🚰',
    name: 'Plumbing & Fixtures',
    description: 'Faucets, pipes, leaks, toilets, sinks, drainage',
  },
  {
    id: 'electrical',
    emoji: '💡',
    name: 'Electrical & Lighting',
    description: 'Light fixtures, switches, power outlets, bulbs',
  },
  {
    id: 'hvac',
    emoji: '❄️',
    name: 'HVAC & Climate',
    description: 'Air conditioning, heating, thermostat, filters',
  },
  {
    id: 'doors_windows',
    emoji: '🚪',
    name: 'Doors, Windows & Locks',
    description: 'Hinges, latches, weatherstripping, screen doors',
  },
  {
    id: 'appliances',
    emoji: '🍳',
    name: 'Kitchen & Major Appliances',
    description: 'Refrigerator, oven, stove, disposal, microwave',
  },
  {
    id: 'carpentry_floors',
    emoji: '🪵',
    name: 'Carpentry & Flooring',
    description: 'Cabinets, baseboards, floor tiles, carpet, safety rails',
  },
  {
    id: 'grounds_patio',
    emoji: '🌿',
    name: 'Grounds, Patio & Balcony',
    description: 'Balcony railing, exterior lights, patio pavers, outdoor areas',
  },
  {
    id: 'paint_walls',
    emoji: '🎨',
    name: 'Paint & Drywall Repair',
    description: 'Drywall cracks, scuffs, touch-up paint, caulking',
  },
  {
    id: 'general_facility',
    emoji: '🛠️',
    name: 'General Facility & Handyman',
    description: 'General repairs, loose fixtures, furniture assembly',
  },
];

export function getCategoryEmoji(categoryName: string): string {
  const match = WORK_ORDER_CATEGORIES.find(
    (c) =>
      c.name.toLowerCase() === categoryName.toLowerCase() ||
      c.id.toLowerCase() === categoryName.toLowerCase() ||
      categoryName.includes(c.name) ||
      categoryName.includes(c.emoji)
  );
  if (match) return match.emoji;
  if (categoryName.toLowerCase().includes('plumb')) return '🚰';
  if (categoryName.toLowerCase().includes('electr') || categoryName.toLowerCase().includes('light')) return '💡';
  if (categoryName.toLowerCase().includes('hvac') || categoryName.toLowerCase().includes('heat') || categoryName.toLowerCase().includes('cool') || categoryName.toLowerCase().includes('air')) return '❄️';
  if (categoryName.toLowerCase().includes('door') || categoryName.toLowerCase().includes('window') || categoryName.toLowerCase().includes('lock')) return '🚪';
  if (categoryName.toLowerCase().includes('appliance') || categoryName.toLowerCase().includes('kitchen')) return '🍳';
  if (categoryName.toLowerCase().includes('carpent') || categoryName.toLowerCase().includes('floor')) return '🪵';
  if (categoryName.toLowerCase().includes('ground') || categoryName.toLowerCase().includes('patio') || categoryName.toLowerCase().includes('balcony')) return '🌿';
  if (categoryName.toLowerCase().includes('paint') || categoryName.toLowerCase().includes('wall')) return '🎨';
  return '🛠️';
}
