/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */

const MONTH_INDEX: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

export function extractNumericDay(day: string | number): number {
  if (typeof day === 'number') return day;
  const match = String(day).match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

/**
 * Sorts community events chronologically from the beginning of the month
 * to the end of the month (early dates first, e.g. Day 1, 2, 11, 18, 22, 29).
 */
export function sortEventsEarlyFirst<T extends { month: string; day: string | number; title?: string }>(
  events: T[]
): T[] {
  return [...events].sort((a, b) => {
    const monthStrA = String(a.month || '').toUpperCase().trim().slice(0, 3);
    const monthStrB = String(b.month || '').toUpperCase().trim().slice(0, 3);

    const monthA = MONTH_INDEX[monthStrA] || 0;
    const monthB = MONTH_INDEX[monthStrB] || 0;

    // If both have recognized months and they differ, sort by month order
    if (monthA !== monthB && monthA !== 0 && monthB !== 0) {
      return monthA - monthB;
    }

    const dayA = extractNumericDay(a.day);
    const dayB = extractNumericDay(b.day);

    if (dayA !== dayB) {
      return dayA - dayB;
    }

    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}
