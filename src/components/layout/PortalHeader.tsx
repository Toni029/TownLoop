/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { logoutUser } from '../../services/auth';
import { getUserRole, getRoleBadgeInfo } from '../../utils/permissions';
import type { PortalSessionState } from '../../hooks/usePortalSession';
import type { PortalDatesState } from '../../hooks/usePortalDates';
import type { AppToastState } from '../../hooks/useAppToast';

interface PortalHeaderProps
  extends Pick<
      PortalSessionState,
      | 'isDarkMode'
      | 'currentUser'
      | 'setIsDarkMode'
      | 'setCurrentUser'
      | 'setIsLoggedOut'
    >,
    Pick<PortalDatesState, 'formattedHeaderDate'>,
    Pick<AppToastState, 'showAppToast'> {
  onOpenAdminPanel?: () => void;
  onSwitchCommunity?: () => void;
}

export function PortalHeader({
  isDarkMode,
  currentUser,
  formattedHeaderDate,
  setIsDarkMode,
  setCurrentUser,
  showAppToast,
  setIsLoggedOut,
  onOpenAdminPanel,
  onSwitchCommunity,
}: PortalHeaderProps) {
  const role = getUserRole(currentUser);
  const badgeInfo = role && role !== 'resident' ? getRoleBadgeInfo(role) : null;

  return (
    <header
      className={`shrink-0 pt-6 px-6 pb-3.5 ${
        isDarkMode
          ? 'bg-slate-950/90 text-white border-slate-800/80'
          : 'bg-[#f7f3ea]/90 text-slate-900 border-[#d8cdbc]/70'
      } backdrop-blur-md sticky top-0 z-20 flex justify-between items-center border-b transition-colors`}
    >
      <div>
        <h1 className="serif-title tracking-tight leading-none">
          <span
            className={`block text-[30px] font-black tracking-tight leading-none ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Good Morning,
          </span>
          <span
            className={`block text-[30px] font-bold mt-1 leading-[28.6667px] ${
              isDarkMode ? 'text-emerald-400' : 'text-[#000000]'
            }`}
          >
            {currentUser?.name ? currentUser.name.split(' ')[0] : 'Resident'}
          </span>
        </h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <p
            className={`text-[13px] font-semibold uppercase tracking-wider ${
              isDarkMode ? 'text-slate-400' : 'text-[#000000]'
            }`}
          >
            {formattedHeaderDate}
          </p>
          {badgeInfo && (
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${badgeInfo.bg}`}
            >
              {(role === 'admin' || role === 'vip' || role === 'staff') && (
                <img
                  src="/vip-badge.svg"
                  alt="VIP Badge"
                  className="w-3.5 h-3.5 object-contain inline-block"
                />
              )}
              {role === 'crew' && (
                <img
                  src="/crew-badge.svg"
                  alt="Crew Badge"
                  className="w-3.5 h-3.5 object-contain inline-block"
                />
              )}
              <span>{badgeInfo.label}</span>
            </span>
          )}
        </div>
      </div>
      <ProfileAvatar
        residentName={currentUser?.name || 'Resident'}
        currentUser={currentUser}
        size="large"
        isDarkMode={isDarkMode}
        onToggleTheme={(dark) => setIsDarkMode(dark)}
        onOpenAdminPanel={onOpenAdminPanel}
        onUpdateProfile={(updated) => {
          setCurrentUser(updated);
          showAppToast('Profile picture updated');
        }}
        onSwitchCommunity={onSwitchCommunity}
        onLogout={async () => {
          await logoutUser();
          setCurrentUser(null);
          setIsLoggedOut(true);
          showAppToast('Signed out safely');
        }}
      />
    </header>
  );
}
