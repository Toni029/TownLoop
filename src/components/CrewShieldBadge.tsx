/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React from 'react';

interface CrewShieldBadgeProps {
  className?: string;
  size?: 'normal' | 'large';
  title?: string;
}

export const CrewShieldBadge: React.FC<CrewShieldBadgeProps> = ({
  className = '',
  size = 'normal',
  title = 'Maintenance Crew Badge',
}) => {
  // Sized a little bigger than the online green dot
  // (Green dot: large = w-5 h-5 [20px], normal = w-3.5 h-3.5 [14px])
  const dimensionClass =
    size === 'large'
      ? 'w-6.5 h-6.5 sm:w-7 sm:h-7'
      : 'w-4.5 h-4.5 sm:w-5 sm:h-5';

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none pointer-events-none drop-shadow-md ${dimensionClass} ${className}`}
      title={title}
      aria-label={title}
    >
      <svg
        viewBox="0 0 200 240"
        className="w-full h-full object-contain filter drop-shadow-sm pointer-events-none select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Outer Shield Contour */}
          <path
            id="crew-shield-outer"
            d="
              M 100 12 
              L 32 12 
              Q 18 12 18 26 
              L 18 116 
              C 18 174 58 214 100 230 
              C 142 214 182 174 182 116 
              L 182 26 
              Q 182 12 168 12 
              Z"
          />

          {/* Inner Shield (Uniform inset providing crisp double-border margin) */}
          <path
            id="crew-shield-inner"
            d="
              M 100 24 
              L 38 24 
              Q 28 24 28 34 
              L 28 112 
              C 28 164 62 198 100 214 
              C 138 198 172 164 172 112 
              L 172 34 
              Q 172 24 162 24 
              Z"
          />

          <clipPath id="crew-inner-shield-clip">
            <use href="#crew-shield-inner" />
          </clipPath>

          {/* Clip Path for Left Half (x <= 100) */}
          <clipPath id="crew-clip-left">
            <rect x="0" y="0" width="100" height="240" />
          </clipPath>

          {/* Clip Path for Right Half (x >= 100) */}
          <clipPath id="crew-clip-right">
            <rect x="100" y="0" width="100" height="240" />
          </clipPath>

          {/* Master Crossed Tools Graphic */}
          <g id="crew-crossed-tools">
            {/* 1. CLAW HAMMER (Pointing to Top-Left, -45 deg) */}
            <g transform="translate(100, 116) rotate(-45)">
              <path
                d="
                  M -6 -36
                  L -16 -37
                  L -18 -34
                  L -26 -34
                  C -27.5 -34 -28.5 -35 -28.5 -36.5
                  L -28.5 -52
                  C -28.5 -53.5 -27.5 -54.5 -26 -54.5
                  L -18 -54.5
                  L -16 -51.5
                  L -6 -52.5
                  L 6 -52.5
                  C 16 -52.5 25 -49 32 -41
                  C 36 -36 38 -29 37 -21
                  C 36.5 -19 34.5 -19.5 34 -21.5
                  C 32.5 -27 29 -32 23 -35
                  C 17 -37.5 11.5 -36.5 6 -36
                  L 6 52
                  C 8.5 54 10 57 10 61
                  C 10 67 5.5 71 0 71
                  C -5.5 71 -10 67 -10 61
                  C -10 57 -8.5 54 -6 52
                  Z"
              />
            </g>

            {/* 2. OPEN-END WRENCH (Pointing to Top-Right, +45 deg) */}
            <g transform="translate(100, 116) rotate(45)">
              <path
                d="
                  M 6.5 -36
                  C 13 -40 19 -48 19 -58
                  C 19 -65 16 -73 12 -77
                  C 11 -78 9.5 -77.5 9 -76
                  L 6.5 -63
                  C 6 -57.5 -6 -57.5 -6.5 -63
                  L -9 -76
                  C -9.5 -77.5 -11 -78 -12 -77
                  C -16 -73 -19 -65 -19 -58
                  C -19 -48 -13 -40 -6.5 -36
                  L -6.5 50
                  C -11 53 -14 58 -14 64
                  C -14 72 -7.5 78 0 78
                  C 7.5 78 14 72 14 64
                  C 14 58 11 53 6.5 50
                  Z"
              />
            </g>
          </g>
        </defs>

        {/* Outer Deep Royal Blue Shield */}
        <use href="#crew-shield-outer" fill="#123680" />

        {/* Crisp White Separator Border Margin */}
        <use href="#crew-shield-outer" fill="none" stroke="#ffffff" strokeWidth="7" />

        {/* Inner Split Shield Base (clipped to shield-inner contour) */}
        <g clipPath="url(#crew-inner-shield-clip)">
          {/* Left Background: Deep Royal Blue */}
          <rect x="0" y="0" width="100" height="240" fill="#123680" />

          {/* Right Background: Crisp Pure White */}
          <rect x="100" y="0" width="100" height="240" fill="#ffffff" />

          {/* Left Half Tools: Pure Solid White (#ffffff) on Blue Canvas */}
          <g clipPath="url(#crew-clip-left)">
            <use href="#crew-crossed-tools" fill="#ffffff" />
          </g>

          {/* Right Half Tools: Solid Deep Royal Blue (#123680) on White Canvas */}
          <g clipPath="url(#crew-clip-right)">
            <use href="#crew-crossed-tools" fill="#123680" />
          </g>
        </g>

        {/* Clean Precision Outer Contour Edges */}
        <use href="#crew-shield-inner" fill="none" stroke="#123680" strokeWidth="3" />
        <use href="#crew-shield-outer" fill="none" stroke="#123680" strokeWidth="4" />
      </svg>
    </div>
  );
};
