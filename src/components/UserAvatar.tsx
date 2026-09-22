/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
  badge?: React.ReactNode;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name = 'Resident',
  size = 'md',
  className = '',
  alt,
  badge,
}) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'R';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);
  const showImage = Boolean(src && !imageError);

  return (
    <div
      className={`relative rounded-full shrink-0 flex items-center justify-center font-bold select-none overflow-hidden ${
        sizeClasses[size]
      } ${
        showImage
          ? 'bg-stone-100 dark:bg-slate-800'
          : 'bg-gradient-to-br from-stone-100 to-stone-200 dark:from-slate-800 dark:to-slate-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-slate-700 shadow-2xs'
      } ${className}`}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt || name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : initials && initials.length > 0 && initials !== 'R' ? (
        <span className="leading-none tracking-tight font-extrabold">{initials}</span>
      ) : (
        <User className={`${iconSizes[size]} text-stone-500 dark:text-stone-400 stroke-[2.2]`} />
      )}
      {badge && <div className="absolute bottom-0 right-0">{badge}</div>}
    </div>
  );
};
