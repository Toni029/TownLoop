/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React from 'react';

interface VipStaffBadgeProps {
  className?: string;
  size?: 'normal' | 'large';
  title?: string;
}

export const VipStaffBadge: React.FC<VipStaffBadgeProps> = ({
  className = '',
  size = 'normal',
  title = 'VIP Staff Badge',
}) => {
  // Balanced dimensions that scale cleanly across normal and large avatar sizes
  const dimensionClass =
    size === 'large'
      ? 'w-7.5 h-7.5 sm:w-8.5 sm:h-8.5'
      : 'w-5.5 h-5.5 sm:w-6 sm:h-6';

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none pointer-events-none drop-shadow-md ${dimensionClass} ${className}`}
      title={title}
      aria-label={title}
    >
      <img
        src="/vip-badge.svg"
        alt={title}
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain filter drop-shadow-sm pointer-events-none select-none"
      />
    </div>
  );
};
