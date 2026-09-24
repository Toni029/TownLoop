/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  MapPin,
  CheckCircle2,
  Users,
  Wrench,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { CecilPinesPines, CecilPinesBadge } from './CecilPinesLogo';

export interface CommunityOption {
  id: string;
  name: string;
  tagline: string;
  location: string;
  badge: string;
  isPrimary?: boolean;
  features: string[];
}

const COMMUNITIES: CommunityOption[] = [
  {
    id: 'cecil_pines',
    name: 'Cecil Pines',
    tagline: 'Active Adult Living Community',
    location: 'Jacksonville, Florida',
    badge: 'Primary Community',
    isPrimary: true,
    features: [
      'Full Resident Portal & Daily Check-Ins',
      'Direct Maintenance Work Order Tracking',
      'Neighborhood Social Feed & Marketplace',
      'Daily Community Activities & Calendars',
    ],
  },
  {
    id: 'demo_community',
    name: 'Demo Community',
    tagline: 'Sample Living Community',
    location: 'Preview & Sandbox Environment',
    badge: 'Interactive Preview',
    isPrimary: false,
    features: [
      'Interactive Sandbox Environment',
      'Pre-loaded Sample Work Orders & Posts',
      'Tour Community Features & Workflows',
    ],
  },
];

interface CommunitySelectorScreenProps {
  onSelectCommunity: (communityId: string) => void;
  isDarkMode?: boolean;
  onToggleTheme?: (dark: boolean) => void;
}

export const CommunitySelectorScreen: React.FC<CommunitySelectorScreenProps> = ({
  onSelectCommunity,
  isDarkMode = false,
  onToggleTheme,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="w-full flex-1 flex flex-col justify-between p-4 sm:p-7 select-none"
    >
      {/* Main Header / Prompt Section */}
      <div className="mt-1 mb-5 text-center space-y-2.5">
        <div className="inline-flex items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>TownLoop Living Portal</span>
          </div>

          {onToggleTheme && (
            <button
              type="button"
              onClick={() => onToggleTheme(!isDarkMode)}
              className="p-1.5 rounded-full border border-stone-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </button>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-tight">
          Welcome to TownLoop
        </h1>

        <p className="text-sm sm:text-base font-medium text-stone-600 dark:text-slate-300 max-w-sm mx-auto">
          Select your community to continue
        </p>
      </div>

      {/* Community Selection Cards */}
      <div className="space-y-4 my-auto">
        {COMMUNITIES.map((comm) => {
          const isPrimary = comm.isPrimary;
          return (
            <div
              key={comm.id}
              role="button"
              tabIndex={0}
              id={`community-card-${comm.id}`}
              onClick={() => onSelectCommunity(comm.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectCommunity(comm.id);
                }
              }}
              className={`group w-full text-left rounded-3xl p-4 sm:p-5 border-2 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md focus:outline-none focus:ring-4 ${
                isPrimary
                  ? isDarkMode
                    ? 'bg-slate-900/95 hover:bg-slate-800/95 border-emerald-600/80 hover:border-emerald-500 focus:ring-emerald-500/30'
                    : 'bg-white hover:bg-emerald-50/40 border-emerald-600 hover:border-emerald-700 focus:ring-emerald-500/30 ring-1 ring-emerald-600/20'
                  : isDarkMode
                  ? 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-700 hover:border-slate-600 focus:ring-slate-500/30'
                  : 'bg-white/85 hover:bg-stone-50 border-stone-300 hover:border-stone-400 focus:ring-stone-400/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  {/* Community Graphic or Icon */}
                  {isPrimary ? (
                    <div className="relative shrink-0">
                      <CecilPinesBadge
                        className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl p-2 sm:p-2.5 shadow-md shadow-emerald-950/25 group-hover:scale-105 transition-transform"
                        pineClassName="w-9 h-9 sm:w-10 sm:h-10"
                      />
                    </div>
                  ) : (
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-stone-500 dark:text-slate-400 shadow-2xs group-hover:scale-105 transition-transform">
                      <Building2 className="w-7 h-7" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white leading-snug">
                        {comm.name}
                      </h2>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shadow-2xs ${
                          isPrimary
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : 'bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-300 dark:border-slate-700'
                        }`}
                      >
                        {comm.badge}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-stone-700 dark:text-slate-200 mt-0.5">
                      {comm.tagline}
                    </p>

                    <div className="flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-slate-400 mt-1">
                      <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{comm.location}</span>
                    </div>
                  </div>
                </div>

                {/* Arrow Icon */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:translate-x-1 ${
                    isPrimary
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 border border-stone-200 dark:border-slate-700'
                  }`}
                >
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                </div>
              </div>

              {/* Feature Points */}
              <div className="mt-3.5 pt-3 border-t border-stone-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {comm.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-[11px] sm:text-xs text-stone-600 dark:text-slate-300"
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isPrimary
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-stone-400 dark:text-slate-500'
                      }`}
                    />
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Primary Call To Action Button inside the card */}
              <div className="mt-3.5">
                <div
                  className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                    isPrimary
                      ? 'bg-emerald-600 group-hover:bg-emerald-700 text-white shadow-xs'
                      : 'bg-stone-200/90 dark:bg-slate-800 group-hover:bg-stone-300/80 dark:group-hover:bg-slate-700 text-stone-800 dark:text-slate-200 border border-stone-300/70 dark:border-slate-700'
                  }`}
                >
                  <span>{isPrimary ? 'Continue with Cecil Pines' : 'Preview Demo Community'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="pt-4 text-center space-y-1.5">
        <p className="text-[11px] text-stone-500 dark:text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Your selection is saved securely on this device. You can switch communities anytime in Settings.</span>
        </p>
        <p className="text-[11px] font-medium text-stone-400 dark:text-slate-500">
          Version 1.0.0 • © 2026 TownLoop • All rights reserved.
        </p>
      </div>
    </motion.div>
  );
};
