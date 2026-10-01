/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import type { CommunityRsvpEvent, PinnedHighlight, NewsletterConfig } from '../types';

export const DEFAULT_NEWSLETTER_CONFIG: NewsletterConfig = {
  id: 'the-breeze-september-2026',
  editionTitle: 'The Breeze: September 2026',
  monthEdition: 'September 2026',
  description:
    'Featuring the 2026 Pet Gallery, Flu Shot Clinic, Continuum of Care Olive Garden Lunch, Make Your Own Sundae Social, Wii Bowling Results & Community Potlucks.',
  isCustomUpload: false,
  isRemoved: false,
};

export function createInitialRsvpEvents(): CommunityRsvpEvent[] {
  return [
    {
      id: 'event-cpac-meeting',
      title: 'CPAC Community Activities Planning Meeting',
      month: 'SEP',
      day: '01',
      time: '2:30 PM – 3:30 PM',
      location: 'Community Center',
      category: 'Community Meeting',
      deadline: 'RSVP by Aug. 27th',
      attendeesCount: 3,
      userRsvp: false,
      attendees: [
        {
          id: 'res-1',
          name: 'Eleanor Rigby',
          unit: 'Cottage 12',
          email: 'eleanor.r@cecilpines.org',
          rsvpdAt: Date.now() - 86400000 * 2,
        },
        {
          id: 'res-2',
          name: 'Arthur Pendelton',
          unit: 'Apt 4B',
          email: 'arthur.p@cecilpines.org',
          rsvpdAt: Date.now() - 86400000,
        },
        {
          id: 'res-3',
          name: 'Martha Higgins',
          unit: 'Unit 7',
          email: 'martha.h@cecilpines.org',
          rsvpdAt: Date.now() - 43200000,
        },
      ],
      description:
        'Activities committee meeting to plan upcoming community events, bus trips, and new resident ideas. Everyone is welcome to attend and sign up.',
    },
    {
      id: 'event-medicare-talk',
      title: 'Medicare, Dizziness & Balance Talk',
      month: 'SEP',
      day: '04',
      time: '10:00 AM – 11:30 AM',
      location: 'Community Center',
      category: 'Educational',
      deadline: 'RSVP by Sept. 3rd',
      attendeesCount: 2,
      userRsvp: false,
      attendees: [
        {
          id: 'res-12',
          name: 'Walter White',
          unit: 'Cottage 9',
          email: 'walter.w@cecilpines.org',
          rsvpdAt: Date.now() - 86400000 * 3,
        },
        {
          id: 'res-13',
          name: 'Evelyn Cross',
          unit: 'Apt 1C',
          email: 'evelyn.c@cecilpines.org',
          rsvpdAt: Date.now() - 86400000,
        },
      ],
      description:
        'Informative seminar on navigating Medicare with Natalie Healthcare and balance tips with Enhabit. Light refreshments provided.',
    },
    {
      id: 'event-lunch-bunch',
      title: 'Lunch Bunch Dining Outing to Green Papaya',
      month: 'SEP',
      day: '11',
      time: '12:00 PM – 2:00 PM',
      location: 'Green Papaya Restaurant (Meet in Lobby)',
      category: 'Dining & Food',
      deadline: 'RSVP by Sept. 7th',
      attendeesCount: 2,
      userRsvp: false,
      attendees: [
        {
          id: 'res-17',
          name: 'Nancy Dickerson',
          unit: 'Cottage 5',
          email: 'nancy.d@cecilpines.org',
          rsvpdAt: Date.now() - 86400000 * 2,
        },
        {
          id: 'res-18',
          name: 'Harold Miller',
          unit: 'Unit 18',
          email: 'harold.m@cecilpines.org',
          rsvpdAt: Date.now() - 50000000,
        },
      ],
      description:
        'Resident group dining trip to Green Papaya. Sign up in advance at the front desk for group seating and transportation.',
    },
    {
      id: 'event-sundae-social',
      title: 'Make Your Own Sundae! Sweet Social',
      month: 'SEP',
      day: '18',
      time: '2:30 PM – 4:00 PM',
      location: 'Community Center / Clubhouse',
      category: 'Social Event',
      deadline: 'RSVP by Sept. 14th',
      attendeesCount: 3,
      userRsvp: false,
      attendees: [
        {
          id: 'res-8',
          name: 'Dorothy Gale',
          unit: 'Cottage 3',
          email: 'dorothy.g@cecilpines.org',
          rsvpdAt: Date.now() - 86400000 * 2,
        },
        {
          id: 'res-9',
          name: 'Frank Shirley',
          unit: 'Unit 14',
          email: 'frank.s@cecilpines.org',
          rsvpdAt: Date.now() - 36000000,
        },
        {
          id: 'res-19',
          name: 'Alice Cooper',
          unit: 'Cottage 1',
          email: 'alice.c@cecilpines.org',
          rsvpdAt: Date.now() - 12000000,
        },
      ],
      description:
        'Build your perfect ice cream sundae with syrups, sprinkles, whipped cream & cherries! Hosted by Alivia Home Health & Community Hospice.',
    },
    {
      id: 'event-pow-mia-day',
      title: 'National POW/MIA Recognition Day Excursion',
      month: 'SEP',
      day: '19',
      time: '11:00 AM – 4:30 PM',
      location: 'National POW/MIA Memorial & Museum (Cecil Field)',
      category: 'Special Event',
      deadline: 'RSVP by Sept. 14th',
      attendeesCount: 0,
      userRsvp: false,
      description:
        'Ceremony, military exhibits, live entertainment, and food. Sign up in advance for group transportation and seating reservations.',
    },
    {
      id: 'event-flu-clinic',
      title: 'Flu Shot Clinic with Walgreens',
      month: 'SEP',
      day: '22',
      time: '10:00 AM – 1:00 PM',
      location: 'Community Center Main Hall',
      category: 'Health & Wellness',
      deadline: 'RSVP by Sept. 18th',
      attendeesCount: 0,
      userRsvp: false,
      description:
        'Walgreens brings Flu and other essential vaccines to Cecil Pines! Bring insurance card and valid photo ID. RSVP required.',
    },
    {
      id: 'event-social-saturday',
      title: 'Social Saturday with Appetizers',
      month: 'SEP',
      day: '26',
      time: '5:30 PM – 7:30 PM',
      location: 'Community Center / Clubhouse',
      category: 'Social Event',
      deadline: 'RSVP by Sept. 21st',
      attendeesCount: 0,
      userRsvp: false,
      description:
        'Resident social evening with delicious appetizers and refreshments. Sign up to attend or bring a favorite finger food to share.',
    },
    {
      id: 'event-pet-gallery-vote',
      title: 'Pet Gallery Contest Voting Deadline',
      month: 'SEP',
      day: '28',
      time: '5:00 PM',
      location: 'Front Office / Phone Voting',
      category: 'Community Life',
      deadline: 'RSVP by Sept. 28th',
      attendeesCount: 0,
      userRsvp: false,
      description:
        'Cast your vote for the cutest pet! Call the office with your favorite entry number (#1 to #19) by Sept. 28th. Donations support EveryPet.',
    },
    {
      id: 'event-care-panel',
      title: 'Continuum of Care Panel Discussion & Lunch',
      month: 'SEP',
      day: '29',
      time: '12:00 PM – 1:30 PM',
      location: 'Community Center',
      category: 'Educational',
      deadline: 'RSVP by Sept. 25th',
      attendeesCount: 0,
      userRsvp: false,
      description:
        'Enjoy catered lunch from Olive Garden while local care providers (Senior Living Placement, Castle Home Health, Vivo Healthcare, Gentiva Hospice) present care resources with Q&A.',
    },
    {
      id: 'event-wii-bowling',
      title: 'Wii Bowling League Registration & Sign-Up',
      month: 'SEP',
      day: '30',
      time: '1:00 PM – 3:00 PM',
      location: 'Clubhouse Wii Station',
      category: 'Sports & Fitness',
      deadline: 'RSVP by Sept. 25th',
      attendeesCount: 0,
      userRsvp: false,
      description:
        'Fall league registration! Congratulate champions "What the Heck" and sign up for next season with coordinators Dan Jowers or Linda Sweeten.',
    },
  ];
}

export function createInitialHighlights(): PinnedHighlight[] {
  return [
    {
      id: 'hl-pet-gallery',
      title: 'The Cecil Pines Pet Gallery Is Here!',
      category: 'Community Life',
      authorLabel: 'CPAC Coordinators',
      description:
        '19 furry contestants are spotlighted on Pages 4 & 5. Call the front desk with your favorite entry number to cast your vote by Sept. 28th!',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'hl-gate-safety',
      title: 'Community Gate Safety Reminder',
      category: 'Safety Notice',
      authorLabel: 'Management',
      description:
        'Please remember DO NOT STOP at the gate while it is opening when entering or exiting the community. Once it begins to open, continue through promptly and safely.',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'hl-key-roundup',
      title: 'Key Roundup Office Notice',
      category: 'Administration',
      authorLabel: 'Management',
      description:
        'If you hold a key to any community building or shared facility, please contact the administrative office to confirm your key assignment.',
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'hl-library-update',
      title: 'Community Library Finishing Touches',
      category: 'Facility Update',
      authorLabel: 'Administration',
      description:
        'The library remodeling is entering its final stages. Thank you for your patience while finishing touches are completed; reopening announcement coming soon!',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'hl-water-quality',
      title: 'JEA Safe Water Quality Results Confirmed',
      category: 'Administration',
      authorLabel: 'Management',
      description:
        'Official water testing results from JEA confirmed drinking water meets all quality and health safety standards across Cecil Pines.',
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'hl-school-drive',
      title: 'Cecil Pines Gets an A+! (School Supplies Drive)',
      category: 'Community Life',
      authorLabel: 'Mrs. Michaels (Educator)',
      description:
        'Teacher Mrs. Michaels sends a warm thank-you to all residents whose donated school supplies helped local classrooms start the academic year prepared.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'hl-wii-results',
      title: 'Wii Bowling Summer League Results & Honors',
      category: 'Sports & Fitness',
      authorLabel: 'Dan Jowers (Wii Coordinator)',
      description:
        'Congratulations to 1st place champions "What the Heck" (19-12), high scorers Gene Skidmore (826) & Veronica Thomas (868), and 300 game bowlers!',
      createdAt: Date.now() - 86400000 * 8,
    },
    {
      id: 'hl-race-dates',
      title: 'Updated Cecil Field Race Dates Schedule',
      category: 'Community Notice',
      authorLabel: 'Administration',
      description:
        'Track schedule: Sept 4 (UNF 3-7pm), Oct 16 (3-7pm) & Oct 17 (6-11am), Oct 22 (Gateway), and Nov 6 & 13 (FHSAA Championships).',
      createdAt: Date.now() - 86400000 * 9,
    },
  ];
}
