/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState } from 'react';
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Building2,
  Sun,
  Moon,
  Phone,
  Mail,
  Lock
} from 'lucide-react';
import { UserProfile } from '../types';
import { CecilPinesPines, CecilPinesBadge, UpcomingCommunityBadge } from './CecilPinesLogo';
import { checkUserApprovalStatus } from '../services/auth';

interface PendingApprovalScreenProps {
  user: UserProfile;
  onApproved: (updatedUser: UserProfile) => void;
  onLogout: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: (dark: boolean) => void;
  onSwitchCommunity?: () => void;
  communityId?: string | null;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({
  user,
  onApproved,
  onLogout,
  isDarkMode = false,
  onToggleTheme,
  onSwitchCommunity,
  communityId,
}) => {
  const isUpcoming = communityId === 'upcoming_community' || communityId === 'demo_community';
  const [isChecking, setIsChecking] = useState(false);
  const [currentApprovalStatus, setCurrentApprovalStatus] = useState<boolean>(Boolean(user.approved));
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  // Sync state if user prop changes
  React.useEffect(() => {
    setCurrentApprovalStatus(Boolean(user.approved));
  }, [user.approved]);

  // Check Firestore server status
  const handleCheckStatus = async () => {
    setIsChecking(true);
    setStatusMessage(null);
    try {
      const isApproved = await checkUserApprovalStatus(user.id);
      if (isApproved) {
        setCurrentApprovalStatus(true);
        setStatusMessage({
          type: 'success',
          text: 'Account approved! Redirecting you to the resident portal...'
        });
        setTimeout(() => {
          onApproved({ ...user, approved: true });
        }, 800);
      } else {
        setCurrentApprovalStatus(false);
        setStatusMessage({
          type: 'info',
          text: 'Account is still pending administrator review. Please check back shortly.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Unable to check approval status. Please try again.'
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Priority for address: dynamically show actual address string typed into sign-up form
  const cachedAddress = typeof window !== 'undefined'
    ? (sessionStorage.getItem(`cecil_pines_registered_address_${user.email?.toLowerCase()}`)
       || sessionStorage.getItem('cecil_pines_registered_address')
       || localStorage.getItem('cecil_pines_registered_address'))
    : null;

  const residentAddress = user.address || cachedAddress || '6100 Normandy Blvd';

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-4 sm:p-6 pb-12 sm:pb-16 text-center animate-in fade-in duration-300 relative min-h-[580px]">
      {/* Top Utility Bar: Switch Community & Theme Toggle */}
      <div className="w-full flex items-center justify-between mb-3 sm:mb-4 z-20">
        {onSwitchCommunity ? (
          <button
            type="button"
            onClick={onSwitchCommunity}
            title="Switch Community"
            aria-label="Switch Community"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-stone-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 border border-stone-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">Switch Community</span>
          </button>
        ) : (
          <div />
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={() => onToggleTheme(!isDarkMode)}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-full bg-stone-100/90 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-600 dark:text-slate-300 border border-stone-200 dark:border-slate-700 transition cursor-pointer shadow-xs active:scale-95 shrink-0 ml-auto"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
          </button>
        )}
      </div>

      {/* Brand Emblem */}
      {isUpcoming ? (
        <UpcomingCommunityBadge className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-2 mb-3 shadow-md" />
      ) : (
        <CecilPinesBadge
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-2 mb-3 shadow-md"
          pineClassName="w-12 h-12 sm:w-14 sm:h-14"
        />
      )}

      <div className="flex flex-col items-center mb-4">
        <h1
          className={`text-2xl sm:text-3xl font-black serif-title tracking-tight leading-none ${
            isUpcoming
              ? isDarkMode
                ? 'text-slate-100'
                : 'text-stone-800'
              : 'text-[#006238] dark:text-[#006238]'
          }`}
        >
          {isUpcoming ? 'Upcoming Community' : 'Cecil Pines'}
        </h1>
        <div
          className={`w-36 sm:w-44 h-0.5 my-1 rounded-full ${
            isUpcoming
              ? isDarkMode
                ? 'bg-gradient-to-r from-transparent via-slate-600 to-transparent'
                : 'bg-gradient-to-r from-transparent via-stone-400 to-transparent'
              : 'bg-gradient-to-r from-transparent via-amber-500 to-transparent'
          }`}
        />
        <span
          className={`text-[13px] font-semibold tracking-wider uppercase ${
            isUpcoming
              ? isDarkMode
                ? 'text-slate-400'
                : 'text-stone-600'
              : 'text-[#006238] dark:text-[#006238] border-[#00623d]'
          }`}
        >
          Active Adult Living Community
        </span>
      </div>

      {/* Main Pending Approval Card - matching reference image tile rounded corners & backdrop shadow */}
      <div className="w-full max-w-md sm:max-w-xl bg-white dark:bg-slate-900/95 rounded-[38px] sm:rounded-[44px] p-6 sm:p-8 shadow-[0_35px_80px_-15px_rgba(50,35,15,0.28),0_15px_30px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_35px_80px_-15px_rgba(0,0,0,0.85),0_15px_35px_-8px_rgba(0,0,0,0.6)] border-2 border-stone-200 dark:border-slate-700/80 text-left space-y-5">
        {/* Status Header Badge */}
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-200 dark:border-amber-800/70">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-amber-900 dark:text-amber-200 leading-tight">
              Registration Pending Approval
            </h2>
            <p className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300 mt-0.5">
              Community administration review required
            </p>
          </div>
        </div>

        {/* Registered Resident Profile Details */}
        <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 dark:bg-slate-900/70 border border-stone-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 text-sm sm:text-base">
            <span className="font-semibold text-stone-500 dark:text-slate-400">Applicant:</span>
            <span className="font-bold text-stone-900 dark:text-white">{user.name}</span>
          </div>
          <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 text-sm sm:text-base">
            <span className="font-semibold text-stone-500 dark:text-slate-400">Email:</span>
            <span className="font-medium text-stone-800 dark:text-slate-200">{user.email}</span>
          </div>
          <div className="flex items-start justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 text-sm sm:text-base gap-3">
            <span className="font-semibold text-stone-500 dark:text-slate-400 shrink-0">Address:</span>
            <span className="font-medium text-stone-800 dark:text-slate-200 text-right break-words max-w-[260px]" title={residentAddress}>{residentAddress}</span>
          </div>
          <div className="flex items-center justify-between text-sm sm:text-base">
            <span className="font-semibold text-stone-500 dark:text-slate-400">Application Status:</span>
            {currentApprovalStatus ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <Clock className="w-4 h-4" />
                Not approved yet
              </span>
            )}
          </div>
        </div>

        {/* Explanation Copy */}
        <div className="text-sm sm:text-base text-stone-700 dark:text-slate-200 space-y-2 leading-relaxed">
          <p>
            Your account was successfully registered, but resident dashboard access is currently pending approval. To safeguard resident privacy and community security, a community administrator will review and approve your application before you can enter.
          </p>
        </div>

        {/* Status Message Feedback */}
        {statusMessage && (
          <div
            className={`p-3.5 sm:p-4 rounded-2xl text-sm sm:text-base flex items-center gap-3 animate-in fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-2 border-emerald-300 dark:border-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-2 border-rose-300 dark:border-rose-800'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-2 border-blue-300 dark:border-blue-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          {/* Check Status Button */}
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="w-full py-3.5 sm:py-4 px-5 rounded-2xl bg-gradient-to-r from-[#175d3a] to-[#124b2e] hover:from-[#1b6b43] hover:to-[#175d3a] disabled:opacity-60 text-white font-bold text-base sm:text-lg shadow-md transition cursor-pointer flex items-center justify-center gap-2.5 active:scale-98 min-h-[52px]"
          >
            <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking Firestore...' : 'Check Approval Status'}</span>
          </button>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-200 text-sm sm:text-base font-semibold transition cursor-pointer flex items-center justify-center gap-2 mt-2 min-h-[46px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out / Switch Account</span>
          </button>

          {/* Switch Community Button */}
          {onSwitchCommunity && (
            <button
              type="button"
              onClick={onSwitchCommunity}
              className="w-full py-2.5 px-4 rounded-xl border border-stone-200 dark:border-slate-800 hover:bg-stone-100 dark:hover:bg-slate-900 text-stone-600 dark:text-slate-300 text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2 mt-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Switch Community</span>
            </button>
          )}
        </div>
      </div>

      {/* Office Contact Info */}
      <div className="mt-5 text-center space-y-1.5">
        <p className="text-sm text-stone-600 dark:text-slate-300 font-medium">
          Need immediate access or have questions?
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-sm font-bold text-[#175d3a] dark:text-emerald-400">
          <span className="flex items-center gap-1.5">
            <Phone className="w-4 h-4" /> (904) 555-0100
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4" /> Leasing & Admin Office
          </span>
        </div>
      </div>
    </div>
  );
};
