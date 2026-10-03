/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { auth } from '../firebase';
import type { ExtractedRsvpEventInput, ExtractedPinnedHighlightInput } from '../types';

export interface ExtractedPreviewEvent {
  title: string;
  date: string;
  day?: string | number;
  month?: string;
  isoDate?: string;
  time: string;
  location: string;
  description: string;
  requiresRsvp: boolean;
  rsvpDetails?: string;
  sourcePage?: number;
}

export interface ExtractedPreviewHighlight {
  title: string;
  summary: string;
  category: string;
}

export interface ClientExtractionResult {
  monthEdition: string;
  events: ExtractedPreviewEvent[];
  highlights: ExtractedPreviewHighlight[];
  rsvp_events: ExtractedRsvpEventInput[];
  pinned_highlights: ExtractedPinnedHighlightInput[];
  sourceModel: string;
}

export interface ClientExtractionOptions {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  editionTitle?: string;
  monthEditionHint?: string;
  textContent?: string;
  onProgress?: (message: string) => void;
}

const MONTH_MAP: Record<string, string> = {
  jan: 'JAN', january: 'JAN',
  feb: 'FEB', february: 'FEB',
  mar: 'MAR', march: 'MAR',
  apr: 'APR', april: 'APR',
  may: 'MAY',
  jun: 'JUN', june: 'JUN',
  jul: 'JUL', july: 'JUL',
  aug: 'AUG', august: 'AUG',
  sep: 'SEP', sept: 'SEP', september: 'SEP',
  oct: 'OCT', october: 'OCT',
  nov: 'NOV', november: 'NOV',
  dec: 'DEC', december: 'DEC',
};

const MONTH_NUMS: Record<string, string> = {
  '01': 'JAN', '1': 'JAN',
  '02': 'FEB', '2': 'FEB',
  '03': 'MAR', '3': 'MAR',
  '04': 'APR', '4': 'APR',
  '05': 'MAY', '5': 'MAY',
  '06': 'JUN', '6': 'JUN',
  '07': 'JUL', '7': 'JUL',
  '08': 'AUG', '8': 'AUG',
  '09': 'SEP', '9': 'SEP',
  '10': 'OCT',
  '11': 'NOV',
  '12': 'DEC',
};

/**
 * Robustly parses 3-letter month abbreviation and 2-digit day number from
 * AI-extracted fields, avoiding year confusion (2026) and word-boundary regex bugs with ordinals (7th, 2nd, 31st).
 */
export function parseRobustMonthAndDay(
  dateStr = '',
  rawDay?: string | number,
  rawMonth?: string,
  rawIsoDate?: string,
  fallbackMonth = ''
): { month: string; day: string } {
  let foundMonth = '';
  let foundDay = '';

  // 1. Direct raw day from AI
  if (rawDay !== undefined && rawDay !== null && String(rawDay).trim()) {
    const num = parseInt(String(rawDay).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 1 && num <= 31) {
      foundDay = String(num).padStart(2, '0');
    }
  }

  // 2. Direct raw month from AI
  if (rawMonth && typeof rawMonth === 'string') {
    const clean = rawMonth.trim().toLowerCase().slice(0, 3);
    if (MONTH_MAP[clean]) foundMonth = MONTH_MAP[clean];
  }

  // 3. From ISO date (YYYY-MM-DD)
  if (rawIsoDate && typeof rawIsoDate === 'string') {
    const isoMatch = rawIsoDate.match(/\b(202\d)-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      if (!foundMonth && MONTH_NUMS[isoMatch[2]]) foundMonth = MONTH_NUMS[isoMatch[2]];
      if (!foundDay) {
        const d = parseInt(isoMatch[3], 10);
        if (d >= 1 && d <= 31) foundDay = String(d).padStart(2, '0');
      }
    }
  }

  // 4. Parse from date string
  const cleanStr = String(dateStr).trim();

  // 4a. Check MM/DD/YYYY or MM/DD format
  const slashMatch = cleanStr.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])(?:\/(?:20)?\d{2})?\b/);
  if (slashMatch) {
    if (!foundMonth) foundMonth = MONTH_NUMS[slashMatch[1]] || fallbackMonth;
    if (!foundDay) foundDay = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
  }

  // 4b. Month name + Day (e.g. October 17th, Oct. 7, Oct 2nd)
  if (!foundDay || !foundMonth) {
    const monthDayMatch = cleanStr.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,\s]+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (monthDayMatch) {
      if (!foundDay) foundDay = String(parseInt(monthDayMatch[1], 10)).padStart(2, '0');
    }
  }

  // 4c. Day + Month name (e.g. 17th of October, 2nd Oct)
  if (!foundDay || !foundMonth) {
    const dayMonthMatch = cleanStr.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
    if (dayMonthMatch) {
      if (!foundDay) foundDay = String(parseInt(dayMonthMatch[1], 10)).padStart(2, '0');
      if (!foundMonth) {
        const mKey = dayMonthMatch[2].toLowerCase().slice(0, 3);
        if (MONTH_MAP[mKey]) foundMonth = MONTH_MAP[mKey];
      }
    }
  }

  // 4d. Weekday + Day (e.g. Saturday the 17th, Friday 2nd)
  if (!foundDay) {
    const weekdayDayMatch = cleanStr.match(/(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)[.,\s]+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (weekdayDayMatch) {
      foundDay = String(parseInt(weekdayDayMatch[1], 10)).padStart(2, '0');
    }
  }

  // 4e. Find month in text if still missing
  if (!foundMonth) {
    const lower = cleanStr.toLowerCase();
    for (const [k, v] of Object.entries(MONTH_MAP)) {
      if (lower.includes(k)) {
        foundMonth = v;
        break;
      }
    }
  }

  // 4f. Any ordinal number (e.g. 17th, 2nd, 31st)
  if (!foundDay) {
    const ordMatch = cleanStr.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/i);
    if (ordMatch) {
      const num = parseInt(ordMatch[1], 10);
      if (num >= 1 && num <= 31) foundDay = String(num).padStart(2, '0');
    }
  }

  // 4g. Strip 4-digit years first, then find any remaining 1-2 digit number
  if (!foundDay) {
    const withoutYears = cleanStr.replace(/\b20\d{2}\b/g, '').replace(/\b\d{1,2}:\d{2}\b/g, '');
    const numMatch = withoutYears.match(/\b([1-9]|[12][0-9]|3[01])\b/);
    if (numMatch) {
      foundDay = String(parseInt(numMatch[1], 10)).padStart(2, '0');
    }
  }

  return {
    month: foundMonth || fallbackMonth,
    day: foundDay || '',
  };
}

/**
 * Identifies standard recurring monthly activities (Home tab calendar routines)
 * that occur automatically every month on a specific weekday without requiring RSVP.
 */
export function isRecurringCalendarActivity(title: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase().trim();

  const recurringKeywords = [
    'bingo',
    'koffee klatch',
    'coffee klatch',
    'kofee klatch',
    'gifted hands',
    'wii bowling',
    'wii sports',
    'bowling league',
    'exercise & movement',
    'exercise and movement',
    'morning exercise',
    'gentle stretch',
    'game night',
    'cards and games',
    'board games',
    'curbside pickup',
    'garbage day',
    'trash collection',
    'puppy play date',
    'puppy play',
    'potluck dinner',
    'community potluck',
    'total potluck',
    'lunch bunch',
    'on-site dermatology',
    'dermatology clinic',
  ];

  return recurringKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * Formats user-friendly error messages from raw error objects.
 */
export function formatGeminiError(err: any): string {
  if (!err) return 'Unknown error occurred during newsletter AI extraction.';

  const raw = err?.message || String(err);

  if (raw.includes('Gemini API key is not configured') || raw.includes('API_KEY_MISSING')) {
    return 'Gemini API key is not configured. Ask your administrator to configure Gemini on the server.';
  }

  if (raw.includes('API key not valid') || raw.includes('INVALID_ARGUMENT') || raw.includes('API_KEY_INVALID')) {
    return 'Gemini API key is invalid or unauthorized. Ask your administrator to verify the server Gemini key.';
  }

  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return 'Gemini API rate limit or quota exceeded. Please wait a moment and try again.';
  }

  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'Gemini API is currently experiencing high demand. Spikes are temporary—please retry shortly.';
  }

  if (raw.includes('timed out') || raw.includes('timeout') || raw.includes('NetworkError') || raw.includes('Failed to fetch')) {
    return 'Network timeout connecting to Gemini API. Please check your internet connection.';
  }

  if (raw.includes('File too large') || raw.includes('413') || raw.includes('exceeds')) {
    return 'Uploaded file is too large for inline multimodal analysis. Please upload a smaller document.';
  }

  return raw;
}

/** Send documents through the authenticated server; API keys never reach the browser. */
export async function extractNewsletter(
  options: ClientExtractionOptions
): Promise<ClientExtractionResult> {
  const cleanBase64 = (options.base64Data || '').trim();
  if (cleanBase64.length < 50) {
    throw new Error('Invalid document data. File appears to be empty or unreadable.');
  }
  const user = auth?.currentUser;
  if (!user) throw new Error('Please sign in before analyzing a newsletter.');
  options.onProgress?.('Analyzing newsletter with Gemini...');
  const response = await fetch('/api/newsletter/extract-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify({
      base64Data: cleanBase64,
      mimeType: options.mimeType || 'application/pdf',
      fileName: options.fileName,
      editionTitle: options.editionTitle,
      monthEdition: options.monthEditionHint,
      textContent: options.textContent,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.error || 'Newsletter analysis is unavailable. Please try again.');
  }
  if (!Array.isArray(result.events) || !Array.isArray(result.highlights) ||
      !Array.isArray(result.rsvp_events) || !Array.isArray(result.pinned_highlights)) {
    throw new Error('Newsletter analysis returned an incomplete result. Please try again.');
  }
  options.onProgress?.('Analysis complete. Preparing review...');
  return result;
}
