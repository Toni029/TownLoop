/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { GoogleGenAI, Type } from '@google/genai';
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

/**
 * Retrieve the Gemini API key from Vite or process environment.
 */
export function getGeminiApiKey(): string {
  let key = '';

  // 1. Check Vite client environment variables
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_GEMINI_API_KEY) {
        key = import.meta.env.VITE_GEMINI_API_KEY;
      } else if ((import.meta.env as any).GEMINI_API_KEY) {
        key = (import.meta.env as any).GEMINI_API_KEY;
      }
    }
  } catch {
    // Ignore context errors
  }

  // 2. Check process.env (injected by Vite define)
  if (!key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        if (process.env.VITE_GEMINI_API_KEY) {
          key = process.env.VITE_GEMINI_API_KEY;
        } else if (process.env.GEMINI_API_KEY) {
          key = process.env.GEMINI_API_KEY;
        }
      }
    } catch {
      // Ignore
    }
  }

  return (key || '').trim();
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
  fallbackMonth = 'OCT'
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
    day: foundDay || '01',
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
    return 'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY.';
  }

  if (raw.includes('API key not valid') || raw.includes('INVALID_ARGUMENT') || raw.includes('API_KEY_INVALID')) {
    return 'Gemini API key is invalid or unauthorized. Please verify VITE_GEMINI_API_KEY.';
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

/**
 * Candidate models to try in sequence.
 * Tries user-specified models first (gemini-2.0-flash, gemini-1.5-flash),
 * and seamlessly cascades to gemini-3.8-flash / gemini-3.1-flash-lite if deprecated or unavailable.
 */
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

/**
 * Executes 100% client-side multimodal Gemini document parsing in the browser.
 * Directly sends base64 PDF/image data as inlineData to Gemini.
 * Strict: Never falls back to mock or demo data.
 */
export async function extractNewsletterClientSide(
  options: ClientExtractionOptions
): Promise<ClientExtractionResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY.');
  }

  const cleanBase64 = (options.base64Data || '').trim();
  const mimeType = (options.mimeType || 'application/pdf').trim();

  if (!cleanBase64 || cleanBase64.length < 50) {
    throw new Error('Invalid document data. File appears to be empty or unreadable.');
  }

  options.onProgress?.('Initializing client-side Gemini AI model...');

  const ai = new GoogleGenAI({
    apiKey,
  });

  const parts: any[] = [
    {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    },
  ];

  if (options.textContent && options.textContent.trim().length > 0) {
    parts.push({
      text: `=== SUPPLEMENTAL BULLETIN NOTES / HIGHLIGHTS ===\n${options.textContent.trim()}\n=== END SUPPLEMENTAL NOTES ===`,
    });
  }

  const prompt = `You are an expert community newsletter analyst. Carefully scan every page, article, calendar grid, date cell, and announcement box from top to bottom.

CRITICAL INSTRUCTIONS FOR GETTING DATES 100% ACCURATE:
1. Locate the Newsletter Edition Month and Year on the front cover or masthead (e.g. "October 2026"). This edition is the anchor for all dates.
2. In community newsletters, dates appear in calendar grids, boxed announcements, schedules, or article headings (e.g. "Saturday, Oct 17", "Wednesday the 7th", "October 24", "10/15", "Nov 2nd").
3. For every event found, determine its exact day of the month as a number:
   - If an event is on "Saturday, Oct 17th", day is "17", month is "OCT", date is "Saturday, October 17, 2026", isoDate is "2026-10-17".
   - If an event is on "Wednesday the 7th", day is "07", month is "OCT", date is "Wednesday, October 7, 2026", isoDate is "2026-10-07".
   - If an event is on "October 2nd", day is "02", month is "OCT", date is "Friday, October 2, 2026", isoDate is "2026-10-02".
   - If an event is in a calendar grid box labeled "14", day is "14", month is "OCT", date is "Wednesday, October 14, 2026", isoDate is "2026-10-14".
   - NEVER confuse the publication year (e.g. 2026) or month number (e.g. 10) with the event day! The day is the specific day of the month (1-31).

*** CRITICAL EXCLUSION RULE — DO NOT EXTRACT RECURRING ROUTINE CALENDAR ACTIVITIES ***
The community already has standard, recurring monthly activities that are automatically displayed on the Home tab calendar. They happen every month on a specific day of the week (NOT a specific calendar date) and DO NOT require RSVP.

DO NOT extract or list ANY of the following recurring routine activities as RSVP Upcoming Events:
1. Bingo / Bingo Night (recurs 2nd & 4th Tuesday of each month at 6:00 PM)
2. Koffee Klatch / Coffee Klatch (recurs every Thursday at 7:30 AM)
3. Gifted Hands / Knitting & Crafts Circle (recurs 1st & 3rd Wednesday of each month at 10:00 AM)
4. Wii Bowling / Bowling League (recurs every Wednesday at 5:00 PM)
5. Exercise & Movement / Morning Stretch (recurs every Monday & Wednesday at 9:00 AM)
6. Game Night / Cards / Board Games (recurs every Monday & Friday at 5:00 PM)
7. Community Potluck / Potluck Dinner (recurs 3rd Tuesday of each month at 5:00 PM)
8. Lunch Bunch / Monthly Lunch (recurs 2nd Friday of each month at 12:00 PM)
9. Puppy Play Date (recurs 1st Monday of each month at 10:00 AM)
10. Garbage Day / Trash Collection (recurs every Wednesday)
11. On-Site Dermatology / Routine Clinic (recurs 2nd Thursday of each month at 9:00 AM)

ONLY extract SPECIAL, edition-specific upcoming events that require RSVP, sign-up, or unique attendance (e.g., Flu Shot Clinics, Special Excursions, Presentations, Holiday Parties, Ice Cream Sundae Socials, Special Committee Planning Meetings, Guest Speakers, or one-off workshops).

*** WHAT TO EXTRACT ***

1. RSVP & Upcoming Events:
Find every special scheduled gathering, meeting, clinic, social, party, or activity that residents attend or RSVP for (excluding the recurring Home calendar routines listed above). For each event, extract:
- "title": The exact name of the event verbatim as printed in the text.
- "day": The specific 1 or 2-digit day of the month (e.g. "17", "07", "02", "24", "31").
- "month": The 3-letter uppercase month abbreviation (e.g. "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP").
- "isoDate": The standard YYYY-MM-DD date resolved using the edition year and month (e.g. "2026-10-17").
- "date": The full human-readable date including weekday if printed (e.g. "Saturday, October 17, 2026" or "Wednesday, Oct 7").
- "time": The exact start time (and end time if listed, e.g. "10:00 AM – 1:00 PM" or "6:30 PM").
- "location": Where it takes place (clubhouse, pool, dining room, zoom, etc.).
- "rsvpDetails": Any sign-up info, RSVP deadlines, contact person, or key notes mentioned for that event.
- "description": Factual description of what is scheduled.
- "requiresRsvp": Set to true if attendance, RSVP, registration, or sign-up is required or suggested.

2. Pinned Highlights:
Extract 5 to 7 of the most important community news items, board updates, policy reminders, or maintenance notices that residents need to know (excluding the social events already captured above).
For each highlight, transcribe:
- "title": The exact headline or title.
- "summary": Factual summary of the news, board update, policy reminder, or maintenance notice verbatim from the document.
- "category": Appropriate category tag (e.g. "Board Notice", "Maintenance", "Policy Reminder", "Community Update", "Safety Notice").

3. Month Edition:
Extract the exact newsletter edition month and year found on the front cover or masthead (e.g. "October 2026").

STRICT ZERO-HALLUCINATION RULES:
- Extract ONLY what is literally printed in the document.
- Do NOT guess or default dates to the 10th or 15th. Read the exact calendar cell, day number, and date header for each event.
- NEVER include recurring routine Home calendar activities (Bingo, Koffee Klatch, Gifted Hands, Wii Bowling, Exercise, Game Night, Potluck).
- Return only clean JSON matching the schema with no conversational text.`;

  parts.push({ text: prompt });

  const generationConfig = {
    systemInstruction:
      'You are an expert community newsletter analyst. Carefully scan every page, article, calendar grid, and announcement box from top to bottom. Extract ONLY information that is literally printed in this document. Never invent or assume dates, times, or events. Extract the exact day of the month for every event. DO NOT extract routine recurring Home calendar events (like Bingo, Koffee Klatch, Gifted Hands, Wii Bowling, Exercise, Game Night, Potluck). Extract only special events requiring RSVP. Output only valid JSON matching the schema with no conversational text.',
    responseMimeType: 'application/json',
    temperature: 0.0,
    maxOutputTokens: 8192,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        monthEdition: {
          type: Type.STRING,
          description: 'The newsletter edition month and year found on the front cover or masthead, e.g. October 2026',
        },
        events: {
          type: Type.ARRAY,
          description: 'Every scheduled gathering, meeting, club, class, party, or activity that residents attend or RSVP for.',
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'The exact name of the event verbatim as printed in the text.',
              },
              day: {
                type: Type.STRING,
                description: 'The 1 or 2-digit day of the month, e.g. "17", "07", "02", "24", "31".',
              },
              month: {
                type: Type.STRING,
                description: 'The 3-letter uppercase month abbreviation, e.g. "OCT", "NOV", "DEC".',
              },
              isoDate: {
                type: Type.STRING,
                description: 'The resolved date in YYYY-MM-DD format, e.g. "2026-10-17".',
              },
              date: {
                type: Type.STRING,
                description: 'The exact human-readable date and day of the week, e.g. "Saturday, October 17, 2026".',
              },
              time: {
                type: Type.STRING,
                description: 'The exact time verbatim as printed in the text.',
              },
              location: {
                type: Type.STRING,
                description: 'Where it takes place (clubhouse, pool, zoom, etc.).',
              },
              rsvpDetails: {
                type: Type.STRING,
                description: 'Any sign-up info, RSVP deadlines, or key notes mentioned for that event.',
              },
              description: {
                type: Type.STRING,
                description: 'Brief factual notes or description of the activity verbatim from the text.',
              },
              requiresRsvp: {
                type: Type.BOOLEAN,
                description: 'Whether attendance, RSVP, or sign-up is required or suggested.',
              },
            },
            required: ['title', 'date', 'day', 'month', 'time', 'location', 'description', 'requiresRsvp'],
          },
        },
        highlights: {
          type: Type.ARRAY,
          description: '5 to 7 of the most important community news items, board updates, policy reminders, or maintenance notices (excluding social events).',
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Exact headline or title of the news item, board update, policy reminder, or maintenance notice.',
              },
              summary: {
                type: Type.STRING,
                description: 'Factual summary of what residents need to know verbatim from the text.',
              },
              category: {
                type: Type.STRING,
                description: 'Category tag, e.g. Board Notice, Maintenance, Policy Reminder, Community Update, Safety Notice.',
              },
            },
            required: ['title', 'summary', 'category'],
          },
        },
      },
      required: ['monthEdition', 'events', 'highlights'],
    },
  };

  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      options.onProgress?.(`Extracting content using ${model}...`);
      console.info(`[Client Gemini] Dispatching document extraction to model: ${model}`);

      // 45-second timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout connecting to Gemini API. Please check your internet connection.')), 45_000);
      });

      const generatePromise = ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: generationConfig,
      });

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const responseText = response?.text;

      if (!responseText || responseText.trim().length === 0) {
        throw new Error(`Model ${model} returned empty response.`);
      }

      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanJson);
      const rawEvents: ExtractedPreviewEvent[] = Array.isArray(parsed.events) ? parsed.events : [];
      const rawHighlights: ExtractedPreviewHighlight[] = Array.isArray(parsed.highlights) ? parsed.highlights : [];
      const monthEdition: string = (parsed.monthEdition || options.monthEditionHint || 'Community Edition').trim();

      // Resolve edition month abbreviation fallback
      let editionMonthAbbr = 'OCT';
      const lowerEdition = monthEdition.toLowerCase();
      for (const [k, v] of Object.entries(MONTH_MAP)) {
        if (lowerEdition.includes(k)) {
          editionMonthAbbr = v;
          break;
        }
      }

      // Filter out standard recurring Home calendar activities from RSVP events
      const validRsvpPreviewEvents = rawEvents.filter((ev) => !isRecurringCalendarActivity(ev.title));

      const rsvpEvents: ExtractedRsvpEventInput[] = validRsvpPreviewEvents.map((ev) => {
        const { month, day } = parseRobustMonthAndDay(
          ev.date || '',
          ev.day,
          ev.month,
          ev.isoDate,
          editionMonthAbbr
        );
        // Ensure preview event also has normalized day/month for UI consistency
        ev.day = day;
        ev.month = month;

        const deadlineText = ev.rsvpDetails?.trim() || (ev.date ? `RSVP for ${ev.date}` : 'RSVP required');
        return {
          title: String(ev.title || 'Community Event').trim(),
          month,
          day,
          time: String(ev.time || 'TBA').trim(),
          location: String(ev.location || 'Community Center').trim(),
          category: 'Special Event',
          deadline: deadlineText,
          capacity: null,
          available_spots: null,
          attendees_count: 0,
          description: String(ev.description || ev.rsvpDetails || '').trim(),
        };
      });

      const pinnedHighlights: ExtractedPinnedHighlightInput[] = rawHighlights.map((h) => ({
        title: String(h.title || 'Community Notice').trim(),
        date: monthEdition,
        summary: String(h.summary || '').trim(),
        tag: String(h.category || 'Community Life').trim(),
      }));

      console.info(
        `[Client Gemini] Successfully parsed ${validRsvpPreviewEvents.length} special events (excluded ${rawEvents.length - validRsvpPreviewEvents.length} routine activities) and ${rawHighlights.length} highlights using ${model}`
      );

      return {
        monthEdition,
        events: validRsvpPreviewEvents,
        highlights: rawHighlights,
        rsvp_events: rsvpEvents,
        pinned_highlights: pinnedHighlights,
        sourceModel: model,
      };
    } catch (err: any) {
      lastError = err;
      const rawMsg = err?.message || String(err);
      console.warn(`[Client Gemini] Model ${model} failed:`, rawMsg);

      // If model not found (404) or unavailable, try next candidate model
      if (rawMsg.includes('404') || rawMsg.includes('not found') || rawMsg.includes('no longer available')) {
        continue;
      }

      // If 503 high demand, try next model
      if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
        continue;
      }

      // If API key is invalid or missing, fail immediately without cycling other models
      if (
        rawMsg.includes('API key') ||
        rawMsg.includes('INVALID_ARGUMENT') ||
        rawMsg.includes('API_KEY_INVALID') ||
        rawMsg.includes('not configured')
      ) {
        throw new Error(formatGeminiError(err));
      }
    }
  }

  // All models failed
  console.error('[Client Gemini] Extraction failed on all candidate models:', lastError);
  throw new Error(formatGeminiError(lastError));
}
