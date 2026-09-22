/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
export interface MonthlyRecurringEvent {
  id: string;
  title: string;
  time: string;
  recurrenceLabel: string;
  category: 'wellness' | 'social' | 'games' | 'creative' | 'dining' | 'health' | 'service';
  location: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconType:
    | 'trash'
    | 'exercise'
    | 'puppy'
    | 'coffee'
    | 'game'
    | 'bowling'
    | 'potluck'
    | 'bingo'
    | 'crafts'
    | 'lunch'
    | 'doctor';
  matches: (params: {
    year: number;
    month: number; // 0-indexed (0 = Jan, 11 = Dec)
    day: number; // 1-31
    dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
    occurrence: number; // 1st, 2nd, 3rd, 4th, 5th occurrence of this weekday in month
    totalOccurrences: number;
  }) => boolean;
}

export const MONTHLY_ACTIVITIES_LIST: MonthlyRecurringEvent[] = [
  {
    id: 'garbage-day',
    title: 'Garbage Day',
    time: 'Morning Collection',
    recurrenceLabel: 'Every Wednesday',
    category: 'service',
    location: 'Curbside Pickup',
    description: 'Weekly trash and recycling collection for all units.',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    iconType: 'trash',
    matches: ({ dayOfWeek }) => dayOfWeek === 3, // Wednesday
  },
  {
    id: 'exercise',
    title: 'Exercise & Movement',
    time: '9:00 AM',
    recurrenceLabel: 'Every Monday & Wednesday',
    category: 'wellness',
    location: 'Fitness Studio / Great Room',
    description: 'Morning gentle stretch, balance, and vitality workout.',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    iconType: 'exercise',
    matches: ({ dayOfWeek }) => dayOfWeek === 1 || dayOfWeek === 3, // Mon & Wed
  },
  {
    id: 'puppy-play-date',
    title: 'Puppy Play Date',
    time: '10:00 AM',
    recurrenceLabel: '1st Monday of each month',
    category: 'social',
    location: 'Pine Grove Dog Park',
    description: 'Community dog social and outdoor playtime for furry residents.',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
    badgeText: 'text-orange-800 dark:text-orange-300',
    badgeBorder: 'border-orange-200 dark:border-orange-800',
    iconType: 'puppy',
    matches: ({ dayOfWeek, occurrence }) => dayOfWeek === 1 && occurrence === 1,
  },
  {
    id: 'koffee-klatch',
    title: 'Koffee Klatch',
    time: '7:30 AM',
    recurrenceLabel: 'Every Thursday',
    category: 'social',
    location: 'Clubhouse Lounge',
    description: 'Fresh coffee, light pastries, and morning neighborly chats.',
    badgeBg: 'bg-yellow-50 dark:bg-yellow-950/40',
    badgeText: 'text-amber-900 dark:text-amber-200',
    badgeBorder: 'border-yellow-200 dark:border-yellow-800',
    iconType: 'coffee',
    matches: ({ dayOfWeek }) => dayOfWeek === 4, // Thursday
  },
  {
    id: 'game-night',
    title: 'Game Night',
    time: '5:00 PM',
    recurrenceLabel: 'Every Monday & Friday',
    category: 'games',
    location: 'Card & Game Room',
    description: 'Board games, card tables, puzzles, and friendly rivalries.',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800',
    iconType: 'game',
    matches: ({ dayOfWeek }) => dayOfWeek === 1 || dayOfWeek === 5, // Mon & Fri
  },
  {
    id: 'wii-bowling',
    title: 'Wii Bowling',
    time: '5:00 PM',
    recurrenceLabel: 'Every Wednesday',
    category: 'games',
    location: 'Media Lounge & Screen Room',
    description: 'Interactive Wii sports bowling league and fun matches.',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    badgeText: 'text-cyan-800 dark:text-cyan-300',
    badgeBorder: 'border-cyan-200 dark:border-cyan-800',
    iconType: 'bowling',
    matches: ({ dayOfWeek }) => dayOfWeek === 3, // Wednesday
  },
  {
    id: 'potluck',
    title: 'Community Potluck Dinner',
    time: '5:00 PM',
    recurrenceLabel: '3rd Tuesday of each month',
    category: 'dining',
    location: 'Dining Hall',
    description: 'Bring a favorite homemade dish or side to share with neighbors.',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
    badgeText: 'text-rose-800 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800',
    iconType: 'potluck',
    matches: ({ dayOfWeek, occurrence }) => dayOfWeek === 2 && occurrence === 3,
  },
  {
    id: 'bingo',
    title: 'Bingo Night',
    time: '6:00 PM',
    recurrenceLabel: '2nd & 4th Tuesday of each month',
    category: 'games',
    location: 'Activity Hall',
    description: 'Classic bingo with prize cards, snacks, and multiple rounds.',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-800 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    iconType: 'bingo',
    matches: ({ dayOfWeek, occurrence }) =>
      dayOfWeek === 2 && (occurrence === 2 || occurrence === 4),
  },
  {
    id: 'gifted-hands',
    title: 'Gifted Hands',
    time: '10:00 AM',
    recurrenceLabel: '1st & 3rd Wednesday of each month',
    category: 'creative',
    location: 'Craft Studio',
    description: 'Knitting, sewing, quilting, and creative handcraft circle.',
    badgeBg: 'bg-pink-50 dark:bg-pink-950/40',
    badgeText: 'text-pink-800 dark:text-pink-300',
    badgeBorder: 'border-pink-200 dark:border-pink-800',
    iconType: 'crafts',
    matches: ({ dayOfWeek, occurrence }) =>
      dayOfWeek === 3 && (occurrence === 1 || occurrence === 3),
  },
  {
    id: 'lunch-bunch',
    title: 'Lunch Bunch',
    time: '12:00 PM',
    recurrenceLabel: '2nd Friday of each month',
    category: 'dining',
    location: 'Clubhouse Dining Room / Outing',
    description: 'Monthly social luncheon gathering and good company.',
    badgeBg: 'bg-teal-50 dark:bg-teal-950/40',
    badgeText: 'text-teal-800 dark:text-teal-300',
    badgeBorder: 'border-teal-200 dark:border-teal-800',
    iconType: 'lunch',
    matches: ({ dayOfWeek, occurrence }) => dayOfWeek === 5 && occurrence === 2,
  },
  {
    id: 'on-site-dermatology',
    title: 'On-Site Dermatology',
    time: '9:00 AM',
    recurrenceLabel: '2nd Thursday of each month',
    category: 'health',
    location: 'Wellness Suite & Clinic Room',
    description: 'Visiting dermatology specialist for skin checkups and routine care.',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-800 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    iconType: 'doctor',
    matches: ({ dayOfWeek, occurrence }) => dayOfWeek === 4 && occurrence === 2,
  },
];

/**
 * Calculates recurring monthly activities for a given date
 */
export function getActivitiesForDate(dateInput: Date | string): MonthlyRecurringEvent[] {
  let date: Date;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-').map(Number);
    if (parts.length === 3) {
      date = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      date = new Date(dateInput);
    }
  } else {
    date = dateInput;
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dayOfWeek = date.getDay();
  const occurrence = Math.ceil(day / 7);

  // Total occurrences of this weekday in this specific month
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDayOfMonth; d++) {
    if (new Date(year, month, d).getDay() === dayOfWeek) {
      count++;
    }
  }

  return MONTHLY_ACTIVITIES_LIST.filter((event) =>
    event.matches({
      year,
      month,
      day,
      dayOfWeek,
      occurrence,
      totalOccurrences: count,
    })
  );
}

/**
 * Returns a map of day numbers to their matching activities for a given month
 */
export function getMonthlyCalendarEvents(year: number, month: number): Record<number, MonthlyRecurringEvent[]> {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const schedule: Record<number, MonthlyRecurringEvent[]> = {};

  for (let day = 1; day <= lastDayOfMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const occurrence = Math.ceil(day / 7);

    // Calculate total occurrences of this weekday in this month
    let totalOccurrences = 0;
    for (let d = 1; d <= lastDayOfMonth; d++) {
      if (new Date(year, month, d).getDay() === dayOfWeek) {
        totalOccurrences++;
      }
    }

    const events = MONTHLY_ACTIVITIES_LIST.filter((event) =>
      event.matches({
        year,
        month,
        day,
        dayOfWeek,
        occurrence,
        totalOccurrences,
      })
    );

    if (events.length > 0) {
      schedule[day] = events;
    }
  }

  return schedule;
}
