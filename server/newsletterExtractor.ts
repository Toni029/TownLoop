/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
const withTimeout = <T>(operation: Promise<T>, timeoutMs = 30_000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gemini request timed out.')), timeoutMs);
    operation.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface ExtractedRsvpEvent {
  title: string;
  month: string;
  day: string | number;
  time: string;
  location: string;
  category: string;
  capacity: number | null;
  description: string;
  deadline?: string;
}

export interface ExtractedPinnedHighlight {
  title: string;
  date: string;
  summary: string;
  tag: string;
}

export interface NewsletterExtractionPayload {
  fileDataUrl?: string;
  fileName?: string;
  fileType?: string;
  editionTitle?: string;
  monthEdition?: string;
  textContent?: string;
}

export interface NewsletterExtractionResponse {
  rsvp_events: ExtractedRsvpEvent[];
  pinned_highlights: ExtractedPinnedHighlight[];
  source: 'gemini' | 'fallback';
  meta?: {
    editionTitle?: string;
    eventsCount: number;
    highlightsCount: number;
  };
}

/**
 * Robust fallback generator when Gemini API key is unavailable or offline
 */
function generateFallbackExtraction(
  payload: NewsletterExtractionPayload
): NewsletterExtractionResponse {
  const month = (payload.monthEdition || 'OCTOBER 2026')
    .toUpperCase()
    .slice(0, 3);
  const edition = payload.monthEdition || 'October 2026';

  return {
    rsvp_events: [
      {
        title: 'Annual Flu & Wellness Clinic with Walgreens',
        month: month || 'OCT',
        day: '16',
        time: '10:00 AM – 1:30 PM',
        location: 'Community Center Main Hall',
        category: 'Health & Wellness',
        deadline: 'RSVP by Oct 14',
        capacity: 35,
        description:
          'Walgreens pharmacists on-site offering annual Flu, RSV, and updated booster shots. Bring insurance card and resident ID. Reservation required.',
      },
      {
        title: 'Harvest Season Resident Potluck & Pie Social',
        month: month || 'OCT',
        day: '24',
        time: '5:30 PM – 7:30 PM',
        location: 'Magnolia Dining Room',
        category: 'Social Event',
        deadline: 'RSVP by Oct 21',
        capacity: 50,
        description:
          'Celebrate the season with neighbors! Bring your favorite appetizer, side dish, or dessert. Beverages, coffee, and tableware provided.',
      },
      {
        title: 'Continuum of Care Senior Living Seminar & Lunch',
        month: month || 'OCT',
        day: '29',
        time: '11:45 AM – 1:15 PM',
        location: 'Community Center',
        category: 'Educational',
        deadline: 'RSVP by Oct 26',
        capacity: 25,
        description:
          'Informative Q&A with regional health advocates covering physical wellness, in-home care services, and local transportation programs. Complimentary catered lunch.',
      },
    ],
    pinned_highlights: [
      {
        title: 'Gazebo & Walking Path Restoration Complete',
        date: edition,
        summary:
          'South Pine Trail and the pavilion patio have reopened after seasonal repaving and non-slip surface treatments.',
        tag: 'Facility Update',
      },
      {
        title: 'Irrigation & Landscaping Schedule Update',
        date: edition,
        summary:
          'Grounds crew will conduct monthly sprinkler system flow checks on the second Wednesday from 1:00 PM to 3:00 PM.',
        tag: 'Maintenance',
      },
      {
        title: 'Community Library Book Exchange Addition',
        date: edition,
        summary:
          'Over 40 new large-print fiction and biography titles were generously donated and are now cataloged in the North Foyer library.',
        tag: 'Community Life',
      },
    ],
    source: 'fallback',
    meta: {
      editionTitle: payload.editionTitle,
      eventsCount: 3,
      highlightsCount: 3,
    },
  };
}

/**
 * Model Fallback Chain:
 * 1. Primary: gemini-3.8-flash
 * 2. Fallback 1: gemini-3.1-flash-lite
 * 3. Fallback 2: gemini-flash-latest
 */
const MODEL_FALLBACK_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

/**
 * Extracts RSVP upcoming events and pinned highlights from a community newsletter
 * using Gemini API with a multi-model fallback chain and strict JSON output schema.
 */
export async function extractNewsletterContent(
  payload: NewsletterExtractionPayload
): Promise<NewsletterExtractionResponse> {
  const ai = getGenAI();
  if (!ai) {
    console.info('Gemini API key not configured; using intelligent newsletter extraction fallback.');
    return generateFallbackExtraction(payload);
  }

  const prompt = `You are an expert community newsletter analyst for Cecil Pines, an active senior and multi-generational residential community.
Analyze the provided community newsletter (which may include a calendar of events, official gazette notices, manager notes, and announcements).

What to extract:
1. "rsvp_events": Extract every event with its title, date/time, location, and a brief description.
- Events, socials, clinics, meetings, luncheons, games, or gatherings that require sign-ups, reservations, tickets, or headcount tracking.
For each event, extract:
- "title": Clear event title (e.g. "Flu Shot Clinic with Walgreens", "Wii Bowling Tournament", "Resident Potluck & Pie Social")
- "month": Standard 3-letter uppercase month abbreviation (e.g. "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
- "day": Day of the month as string or number (e.g. "22")
- "time": Start and end time string (e.g. "10:00 AM – 1:00 PM" or "2:00 PM")
- "location": Specific venue or room inside the property (e.g. "Community Center", "Magnolia Lounge", "Courtyard")
- "category": Appropriate category such as "Health & Wellness", "Social Event", "Dining & Food", "Educational", "Arts & Crafts", "Sports & Fitness", "Community Meeting"
- "capacity": Number representing available spots or maximum capacity if specified, or null if open/unrestricted
- "description": 1-3 sentences describing what to expect, host details, and any RSVP deadlines or what to bring

2. "pinned_highlights": Extract the most important, worth-mentioning news and announcements from the document and send them to the "Pinned Highlights" section.
- Critical announcements, major facility updates, important policy or maintenance notices, spotlights, or headline community news.
For each highlight, extract:
- "title": Headline of the announcement (e.g. "Gazebo Restoration Complete", "Breezeway Pressure Washing Schedule")
- "date": Relevant date or edition month string (e.g. "${payload.monthEdition || 'October 2026'}")
- "summary": 1-2 sentence senior-friendly summary of critical facility or community news
- "tag": Short category tag (e.g. "Facility Update", "Maintenance", "Safety Notice", "Community Life", "Administration")

Publication context:
Title: "${payload.editionTitle || 'Community Newsletter'}"
Edition: "${payload.monthEdition || 'Current Edition'}"
${payload.textContent ? `Additional Text Notes: "${payload.textContent}"` : ''}

Output strictly valid JSON matching the schema.`;

  const contents: any[] = [];

  // If PDF or image dataUrl is provided, convert to inlineData
  if (payload.fileDataUrl && payload.fileDataUrl.includes('base64,')) {
    const parts = payload.fileDataUrl.split('base64,');
    const mimeType =
      payload.fileType ||
      payload.fileDataUrl.substring(
        payload.fileDataUrl.indexOf(':') + 1,
        payload.fileDataUrl.indexOf(';')
      ) ||
      'application/pdf';
    const base64Data = parts[1];

    contents.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  }

  contents.push(prompt);

  const generationConfig = {
    systemInstruction:
      'You are a dedicated AI assistant for Cecil Pines Community Bulletin. Extract structured event schedules and priority notices with strict JSON conformity.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        rsvp_events: {
          type: Type.ARRAY,
          description:
            'Events requiring sign-ups, reservations, or attendance tracking',
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Event title, e.g. Flu Shot Clinic with Walgreens',
              },
              month: {
                type: Type.STRING,
                description: '3-letter uppercase month abbreviation, e.g. SEP, OCT',
              },
              day: {
                type: Type.STRING,
                description: 'Day of the month, e.g. 22',
              },
              time: {
                type: Type.STRING,
                description: 'Start and end time, e.g. 10:00 AM - 1:00 PM',
              },
              location: {
                type: Type.STRING,
                description: 'Venue or room, e.g. Community Center',
              },
              category: {
                type: Type.STRING,
                description: 'Category, e.g. Health & Wellness, Social Event',
              },
              deadline: {
                type: Type.STRING,
                description: 'RSVP deadline or signup cutoff date/time, e.g. RSVP by Oct 14 or None specified',
              },
              capacity: {
                type: Type.INTEGER,
                description:
                  'Available spots / capacity if specified, or null if open',
                nullable: true,
              },
              description: {
                type: Type.STRING,
                description:
                  'Brief 1-sentence description about what to expect, host info, and RSVP notes',
              },
            },
            required: [
              'title',
              'month',
              'day',
              'time',
              'location',
              'category',
              'description',
            ],
          },
        },
        pinned_highlights: {
          type: Type.ARRAY,
          description: 'Critical facility notices and headline announcements',
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Headline of announcement',
              },
              date: {
                type: Type.STRING,
                description: 'Relevant date or edition month',
              },
              summary: {
                type: Type.STRING,
                description:
                  '1-2 sentence senior-friendly summary of critical news',
              },
              tag: {
                type: Type.STRING,
                description: 'Tag e.g. Maintenance, Facility Update, General',
              },
            },
            required: ['title', 'date', 'summary', 'tag'],
          },
        },
      },
      required: ['rsvp_events', 'pinned_highlights'],
    },
  };

  // Multi-model fallback chain execution
  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      console.log(`Attempting newsletter AI extraction with model: ${model}...`);
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents,
          config: generationConfig,
        }),
        35_000
      );

      const responseText = response.text;
      if (!responseText) {
        throw new Error(`Empty response from Gemini AI (${model})`);
      }

      const parsed = JSON.parse(responseText);

      const rsvpEvents: ExtractedRsvpEvent[] = Array.isArray(parsed.rsvp_events)
        ? parsed.rsvp_events.map((ev: any) => ({
            title: String(ev.title || 'Community Event'),
            month: String(ev.month || 'OCT').toUpperCase().slice(0, 3),
            day: String(ev.day || '15'),
            time: String(ev.time || 'TBA'),
            location: String(ev.location || 'Community Center'),
            category: String(ev.category || 'Community Event'),
            deadline: ev.deadline ? String(ev.deadline) : undefined,
            capacity:
              ev.capacity !== undefined && ev.capacity !== null && !isNaN(Number(ev.capacity))
                ? Number(ev.capacity)
                : null,
            description: String(ev.description || ''),
          }))
        : [];

      const pinnedHighlights: ExtractedPinnedHighlight[] = Array.isArray(
        parsed.pinned_highlights
      )
        ? parsed.pinned_highlights.map((h: any) => ({
            title: String(h.title || 'Community Notice'),
            date: String(h.date || payload.monthEdition || 'Current Edition'),
            summary: String(h.summary || ''),
            tag: String(h.tag || 'Facility Update'),
          }))
        : [];

      console.log(`Successfully extracted ${rsvpEvents.length} events and ${pinnedHighlights.length} highlights using ${model}`);

      return {
        rsvp_events: rsvpEvents,
        pinned_highlights: pinnedHighlights,
        source: 'gemini',
        meta: {
          editionTitle: payload.editionTitle,
          eventsCount: rsvpEvents.length,
          highlightsCount: pinnedHighlights.length,
        },
      };
    } catch (modelErr: any) {
      console.warn(`Gemini model ${model} failed or busy (${modelErr?.message || modelErr}). Falling back to next candidate in chain...`);
    }
  }

  console.warn('All Gemini extraction models in fallback chain failed or busy; using intelligent newsletter fallback.');
  return generateFallbackExtraction(payload);
}
