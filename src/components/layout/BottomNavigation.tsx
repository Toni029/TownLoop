/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React from 'react';
import { motion } from 'motion/react';
import { FileText, Wrench, Users, Home as HomeIcon } from 'lucide-react';
import type { PortalTab } from '../../types';

type BottomNavigationProps = {
  setActiveTab: (tab: PortalTab) => void;
  activeTab: PortalTab;
};

const TABS: { id: PortalTab; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'news', label: 'News', icon: FileText },
  { id: 'workorders', label: 'Work Orders', icon: Wrench },
  { id: 'social', label: 'Social', icon: Users },
];

export function BottomNavigation({
  setActiveTab,
  activeTab,
}: BottomNavigationProps) {
  return (
    <div className="fixed sm:absolute bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-[430px] sm:max-w-[450px] z-30">
      <nav
        className="liquid-dock relative grid grid-cols-4 w-full items-center"
        aria-label="Bottom navigation dock"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const isWorkOrders = tab.id === 'workorders';

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center py-2 sm:py-2.5 transition-all cursor-pointer text-black"
              aria-label={`${tab.label} tab`}
            >
              {/* Liquid Glass Bubble Indicator directly anchored and centered to each tab button */}
              {isActive && (
                <motion.div
                  layoutId="liquid-glass-indicator"
                  className={`liquid-glass-oval absolute inset-y-0 pointer-events-none ${
                    isWorkOrders
                      ? '-inset-x-2 sm:-inset-x-2.5'
                      : 'inset-x-1 sm:inset-x-1.5'
                  }`}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 30,
                  }}
                />
              )}

              <div
                className={`relative z-10 flex flex-col items-center justify-center transition-transform duration-200 ${
                  isActive ? 'scale-105 font-black' : 'font-extrabold hover:scale-102'
                }`}
              >
                <Icon
                  className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]"
                  stroke="#000000"
                  color="#000000"
                />
                <span
                  className={`text-xs sm:text-[13px] font-black tracking-tight mt-1 text-black ${
                    isWorkOrders ? 'whitespace-nowrap px-0.5' : ''
                  }`}
                  style={{ color: '#000000' }}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
