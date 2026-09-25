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
  title = 'Crew Badge',
}) => {
  const dimensionClass =
    size === 'large'
      ? 'w-6 h-6 sm:w-6.5 sm:h-6.5'
      : 'w-4.5 h-4.5 sm:w-5 sm:h-5';

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none pointer-events-none drop-shadow-md ${dimensionClass} ${className}`}
      title={title}
      aria-label={title}
    >
      <img
        src="/crew-badge.svg"
        alt="Crew Badge"
        className="w-5 h-5 object-contain inline-block"
      />
    </div>
  );
};

