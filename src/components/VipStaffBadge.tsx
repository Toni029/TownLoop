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
  role?: 'admin' | 'staff' | 'vip' | 'crew' | string;
  title?: string;
}

export const VipStaffBadge: React.FC<VipStaffBadgeProps> = ({
  className = '',
  size = 'normal',
  role,
  title,
}) => {
  const isCrewBadge = role === 'crew';
  const defaultTitle = isCrewBadge ? 'Crew Badge' : 'VIP Badge';
  const badgeTitle = title || defaultTitle;

  const dimensionClass =
    size === 'large'
      ? 'w-6 h-6 sm:w-6.5 sm:h-6.5'
      : 'w-4.5 h-4.5 sm:w-5 sm:h-5';

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none pointer-events-none drop-shadow-md ${dimensionClass} ${className}`}
      title={badgeTitle}
      aria-label={badgeTitle}
    >
      {isCrewBadge ? (
        <img
          src="/crew-badge.svg"
          alt="Crew Badge"
          className="w-full h-full object-contain inline-block"
        />
      ) : (
        <img
          src="/vip-badge.svg"
          alt="VIP Badge"
          className="w-full h-full object-contain inline-block"
        />
      )}
    </div>
  );
};

