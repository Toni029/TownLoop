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
      id: 'event-5',
      title: 'Lunch Bunch: Green Papaya Thai & Sushi',
      month: 'SEP',
      day: '11',
      time: '12:00 PM',
      location: '8635 Blanding Blvd',
      category: 'Dining Out',
      deadline: 'Sign up by Sep 9',
      attendeesCount: 16,
      spotsLeft: 6,
      userRsvp: false,
      description:
        'Join the Cecil Pines Lunch Bunch for delicious Thai and sushi cuisine. Carpools meet in the main parking lot at 11:30 AM.',
    },
    {
      id: 'event-3',
      title: 'Make Your Own Sundae Social 🍨',
      month: 'SEP',
      day: '18',
      time: '2:30 PM – 4:00 PM',
      location: 'Magnolia Lounge',
      category: 'Social Event',
      deadline: 'RSVP by Sep 16',
      attendeesCount: 42,
      spotsLeft: 15,
      userRsvp: true,
      description:
        'Build your dream ice cream sundae with sprinkles, syrups, whipped cream, and cherries! Hosted by Alivia Home Health & Community Hospice.',
    },
    {
      id: 'event-1',
      title: 'Flu Shot Clinic with Walgreens',
      month: 'SEP',
      day: '22',
      time: '10:00 AM – 1:00 PM',
      location: 'Community Center',
      category: 'Health & Wellness',
      deadline: 'RSVP by Sep 18',
      attendeesCount: 24,
      spotsLeft: 12,
      userRsvp: true,
      description:
        'Arm yourself! Walgreens will provide Flu & various health shots. Bring your insurance card and photo I.D. *RSVP REQUIRED by Sept 18th*.',
    },
    {
      id: 'event-4',
      title: 'Social Saturday Finger Food Potluck',
      month: 'SEP',
      day: '26',
      time: '5:30 PM – 7:30 PM',
      location: 'Community Center',
      category: 'Potluck & Dining',
      deadline: 'Sign up by Sep 24',
      attendeesCount: 31,
      spotsLeft: 20,
      userRsvp: false,
      description:
        'Bring your favorite finger food or appetizer to share and join neighbors for a wonderful evening of fellowship and delicious bites.',
    },
    {
      id: 'event-2',
      title: 'Continuum of Care Panel & Olive Garden Lunch',
      month: 'SEP',
      day: '29',
      time: '12:00 PM – 1:30 PM',
      location: 'Community Center Main Hall',
      category: 'Educational & Lunch',
      deadline: 'RSVP by Sep 25',
      attendeesCount: 38,
      spotsLeft: 8,
      userRsvp: false,
      description:
        'Enjoy a delicious complimentary lunch from Olive Garden while local care providers (Castle Home Health, Vivo, Gentiva Hospice) answer questions and share resources.',
    },
  ];
}

export function createInitialHighlights(): PinnedHighlight[] {
  return [
    {
      id: 'highlight-1',
      title: 'South Pine Loop & Gazebo Restoration Complete',
      category: 'Facility Update',
      authorLabel: 'Pinned by Management',
      description:
        'New cushioned teak benches, level non-slip paved footpaths, and soft twilight solar lamps are officially open for evening resident walks.',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'highlight-2',
      title: 'High-Speed Wi-Fi Installed in All Common Lounges',
      category: 'Resident Amenity',
      authorLabel: 'Tech Concierge',
      description:
        'Connect seamlessly to network CecilPines-Resident across the Library Lounge, Game Room, and Magnolia Hall without a password.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'highlight-3',
      title: '2026 Pet Gallery Voting Open!',
      category: 'Community Contest',
      authorLabel: 'CPAC Coordinators',
      description:
        'Vote for Cecil Pines Cutest Pet by calling the front desk or stopping by the gallery before Sept. 28th! Contestants #1 to #19 are featured in The Breeze.',
      createdAt: Date.now() - 86400000,
    },
  ];
}
