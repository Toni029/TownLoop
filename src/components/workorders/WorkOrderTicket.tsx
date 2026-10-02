/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React from 'react';

interface WorkOrderTicketProps {
  code: string;
  isDone?: boolean;
  className?: string;
}

/**
 * WorkOrderTicket Component
 * Scaled, compact ticket graphic:
 * - Refined, compact ticket icon sizing (fits naturally in the list row)
 * - Barcode strictly contained within the right stub lines with generous padding
 * - Clean concave corner cutouts and perforated punch cuts
 * - Work order number scaled to a proportional, legible font size
 */
export const WorkOrderTicket = React.memo(function WorkOrderTicket({
  code,
  isDone = false,
  className = '',
}: WorkOrderTicketProps) {
  // Barcode stripes with strictly bounded heights and safe margins inside the stub (y: 23 to 67, x: 168 to 186)
  const barcodeBars = [
    { y: 23, h: 1.8 },
    { y: 26.2, h: 1.2 },
    { y: 28.6, h: 2.2 },
    { y: 32, h: 1.2 },
    { y: 34.4, h: 2.6 },
    { y: 38.2, h: 1.4 },
    { y: 40.8, h: 1.2 },
    { y: 43.2, h: 2.4 },
    { y: 46.8, h: 1.4 },
    { y: 49.4, h: 1.2 },
    { y: 51.8, h: 2.6 },
    { y: 55.6, h: 1.8 },
    { y: 58.6, h: 1.2 },
    { y: 61, h: 2.2 },
    { y: 64.4, h: 1.4 },
  ];

  return (
    <div
      className={`relative inline-flex items-center shrink-0 select-none group/ticket transition-transform duration-200 hover:scale-[1.02] w-[102px] sm:w-[118px] h-[36px] sm:h-[42px] ${className}`}
      title={`Work Order Ticket #${code}`}
    >
      {/* Scalable SVG Ticket Graphic */}
      <svg
        viewBox="0 0 200 90"
        className="w-full h-full drop-shadow-2xs overflow-hidden"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ticket body outline with concave corner cutouts and perforated side holes */}
        <path
          d="
            M 20 4
            L 176 4
            A 16 16 0 0 0 196 20
            L 196 24.1
            A 2.5 2.5 0 0 0 196 29.1
            L 196 33.3
            A 2.5 2.5 0 0 0 196 38.3
            L 196 42.5
            A 2.5 2.5 0 0 0 196 47.5
            L 196 51.7
            A 2.5 2.5 0 0 0 196 56.7
            L 196 60.9
            A 2.5 2.5 0 0 0 196 65.9
            L 196 70
            A 16 16 0 0 0 176 86
            L 20 86
            A 16 16 0 0 0 4 70
            L 4 65.9
            A 2.5 2.5 0 0 0 4 60.9
            L 4 56.7
            A 2.5 2.5 0 0 0 4 51.7
            L 4 47.5
            A 2.5 2.5 0 0 0 4 42.5
            L 4 38.3
            A 2.5 2.5 0 0 0 4 33.3
            L 4 29.1
            A 2.5 2.5 0 0 0 4 24.1
            L 4 20
            A 16 16 0 0 0 20 4
            Z
          "
          className={`transition-colors duration-200 ${
            isDone
              ? 'fill-stone-100 dark:fill-stone-800 stroke-stone-400 dark:stroke-stone-600'
              : 'fill-white dark:fill-stone-900 stroke-stone-950 dark:stroke-stone-100'
          }`}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Vertical Divider separating main body and barcode stub */}
        <line
          x1="162"
          y1="4"
          x2="162"
          y2="86"
          className={`transition-colors duration-200 ${
            isDone
              ? 'stroke-stone-300 dark:stroke-stone-600'
              : 'stroke-stone-950 dark:stroke-stone-200'
          }`}
          strokeWidth="1.8"
        />

        {/* Barcode Strip safely inside the stub with ample clearance */}
        <g
          className={`transition-opacity duration-200 ${
            isDone
              ? 'fill-stone-400 dark:fill-stone-600 opacity-60'
              : 'fill-stone-950 dark:fill-stone-100'
          }`}
        >
          {barcodeBars.map((bar, idx) => (
            <rect
              key={idx}
              x="168"
              y={bar.y}
              width="18"
              height={bar.h}
              rx="0.4"
            />
          ))}
        </g>
      </svg>

      {/* Main Ticket Interior: Centered Work Order Number inside Ticket Icon */}
      <div
        className="absolute inset-y-0 left-0 right-[15%] sm:right-[16%] flex items-center justify-center pointer-events-none px-1"
      >
        <span
          className={`font-dotrice text-[14px] sm:text-[16px] font-bold tracking-wide text-center select-all truncate leading-none ${
            isDone
              ? 'text-stone-500 dark:text-stone-400 line-through decoration-stone-400'
              : 'text-stone-950 dark:text-white'
          }`}
        >
          {code}
        </span>
      </div>
    </div>
  );
});
