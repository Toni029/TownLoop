/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, type RefObject } from 'react';
import { Maximize2, Smartphone } from 'lucide-react';
import { CommunitySelectorScreen } from './components/CommunitySelectorScreen';
import { AuthScreen } from './components/AuthScreen';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';
import { logoutUser } from './services/auth';
import type { PortalTab } from './types';
import { usePortalSession } from './hooks/usePortalSession';
import { usePortalDates } from './hooks/usePortalDates';
import { useHomeState } from './hooks/useHomeState';
import { useWorkOrders } from './hooks/useWorkOrders';
import { useNewsState } from './hooks/useNewsState';
import { useAppToast } from './hooks/useAppToast';
import { useCommunityState } from './hooks/useCommunityState';
import { HomeScreen } from './screens/HomeScreen';
import { NewsScreen } from './screens/NewsScreen';
import { WorkOrdersScreen } from './screens/WorkOrdersScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { PortalHeader } from './components/layout/PortalHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { PortalModals } from './components/PortalModals';
import { AdminPanelModal } from './components/AdminPanelModal';

export default function App() {
  const COMMUNITY_STORAGE_KEY = 'selected_community';

  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(() => {
    try {
      return localStorage.getItem(COMMUNITY_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const handleSelectCommunity = (communityId: string) => {
    try {
      localStorage.setItem(COMMUNITY_STORAGE_KEY, communityId);
    } catch (e) {
      console.warn('Could not persist community selection:', e);
    }
    setSelectedCommunity(communityId);
  };

  const handleSwitchCommunity = () => {
    try {
      localStorage.removeItem(COMMUNITY_STORAGE_KEY);
    } catch (e) {
      console.warn('Could not remove community selection:', e);
    }
    setSelectedCommunity(null);
  };

  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  const [isFullWidthPreview, setIsFullWidthPreview] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Keep feature state mounted across tabs; screens only control presentation.
  const session = usePortalSession();
  const dates = usePortalDates();
  const home = useHomeState(dates.todayStr, dates.tomorrowStr);
  const notifications = useAppToast();
  const workOrders = useWorkOrders(session.currentUser, notifications.showAppToast);
  const news = useNewsState();
  const community = useCommunityState(
    session.currentUser,
    notifications.showAppToast
  );
  const {
    currentUser,
    isLoggedOut,
    isAuthLoading,
    isDarkMode,
    setIsDarkMode,
    setCurrentUser,
    setIsLoggedOut,
  } = session;
  const { showAppToast } = notifications;

  // Dedicated independent scroll containers for each tab
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const newsScrollRef = useRef<HTMLDivElement>(null);
  const workOrdersScrollRef = useRef<HTMLDivElement>(null);
  const socialScrollRef = useRef<HTMLDivElement>(null);

  const tabScrollRefs: Record<PortalTab, RefObject<HTMLDivElement | null>> = {
    home: homeScrollRef,
    news: newsScrollRef,
    workorders: workOrdersScrollRef,
    social: socialScrollRef,
  };

  // Remember scroll distance independently for each tab
  const scrollPositionsRef = useRef<Record<PortalTab, number>>({
    home: 0,
    news: 0,
    workorders: 0,
    social: 0,
  });

  const handleTabScroll = (tab: PortalTab, scrollTop: number) => {
    scrollPositionsRef.current[tab] = scrollTop;
  };

  const handleSelectTab = useCallback(
    (tab: PortalTab) => {
      if (tab === activeTab) {
        // Tapping the active tab smoothly returns to top
        const targetRef = tabScrollRefs[tab];
        if (targetRef?.current) {
          targetRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          scrollPositionsRef.current[tab] = 0;
        }
      } else {
        setActiveTab(tab);
      }
    },
    [activeTab]
  );

  // Restore the selected tab's individual scroll position upon switching tabs
  useLayoutEffect(() => {
    const targetRef = tabScrollRefs[activeTab];
    if (targetRef?.current) {
      const savedPosition = scrollPositionsRef.current[activeTab] || 0;
      targetRef.current.scrollTop = savedPosition;
      requestAnimationFrame(() => {
        if (targetRef.current && targetRef.current.scrollTop !== savedPosition) {
          targetRef.current.scrollTop = savedPosition;
        }
      });
    }
    // Safeguard outer viewport scroll on mobile
    if (typeof window !== 'undefined' && window.scrollY > 0) {
      window.scrollTo(0, 0);
    }
  }, [activeTab]);

  // Always reset to the 'home' tab whenever a user logs in, switches accounts, or launches the app
  useEffect(() => {
    if (currentUser && currentUser.approved !== false && !isLoggedOut) {
      setActiveTab('home');
      scrollPositionsRef.current = {
        home: 0,
        news: 0,
        workorders: 0,
        social: 0,
      };
      if (homeScrollRef.current) {
        homeScrollRef.current.scrollTop = 0;
      }
    }
  }, [currentUser?.id, currentUser?.approved, isLoggedOut]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf6f0] via-[#f5ede2] to-[#e9decb] flex flex-col items-center justify-start sm:py-6 sm:px-4 selection:bg-amber-100">
      {/* Top Utility Bar for Preview Mode Switching */}
      <div
        className={`w-full ${isFullWidthPreview ? 'max-w-3xl' : !selectedCommunity || isLoggedOut || !currentUser || currentUser?.approved === false ? 'max-w-xl' : 'max-w-md'} mb-2 px-3 hidden sm:flex items-center justify-between text-xs text-stone-500`}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Live Interactive Preview</span>
        </div>
        <button
          onClick={() => setIsFullWidthPreview(!isFullWidthPreview)}
          className="flex items-center gap-1 hover:text-stone-800 transition py-1 px-2.5 rounded-xl bg-white/80 backdrop-blur-sm border border-stone-200/80 shadow-xs"
          title="Toggle container size"
        >
          {isFullWidthPreview ? (
            <>
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Frame</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Expanded View</span>
            </>
          )}
        </button>
      </div>

      {/* Main Container */}
      <div
        className={`w-full ${
          isFullWidthPreview
            ? 'max-w-3xl'
            : !selectedCommunity || isLoggedOut || !currentUser || currentUser?.approved === false
              ? 'max-w-xl'
              : 'max-w-md'
        } ${
          isDarkMode
            ? 'dark bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 border-slate-800'
            : 'bg-gradient-to-b from-[#f7f3ea] via-[#f1ebe0] to-[#e8decb] text-slate-900 border-[#d8cdbc]'
        } ${
          !selectedCommunity || isLoggedOut || !currentUser || currentUser?.approved === false
            ? 'min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:my-auto overflow-y-auto'
            : 'h-[100dvh] sm:h-auto sm:min-h-[860px] sm:max-h-[920px] overflow-hidden'
        } sm:rounded-[44px] shadow-[0_24px_50px_-12px_rgba(110,85,60,0.12)] relative flex flex-col justify-start border transition-all duration-300`}
      >
        {/* Community Selector / Auth / Main Screen State */}
        {!selectedCommunity ? (
          <CommunitySelectorScreen
            onSelectCommunity={handleSelectCommunity}
            isDarkMode={isDarkMode}
            onToggleTheme={(dark) => setIsDarkMode(dark)}
          />
        ) : isAuthLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">
              Connecting to Firebase services...
            </p>
          </div>
        ) : isLoggedOut || !currentUser ? (
          <AuthScreen
            isDarkMode={isDarkMode}
            onToggleTheme={(dark) => setIsDarkMode(dark)}
            onSwitchCommunity={handleSwitchCommunity}
            onAuthSuccess={(user) => {
              setCurrentUser(user);
              setIsLoggedOut(false);
              setActiveTab('home');
              if (user.approved === false) {
                showAppToast('Account pending administrator approval.');
              } else {
                showAppToast(`Welcome back, ${user.name}!`);
              }
            }}
          />
        ) : currentUser.approved === false ? (
          <PendingApprovalScreen
            user={currentUser}
            isDarkMode={isDarkMode}
            onToggleTheme={(dark) => setIsDarkMode(dark)}
            onSwitchCommunity={handleSwitchCommunity}
            onApproved={(updatedUser) => {
              setCurrentUser(updatedUser);
              setActiveTab('home');
              showAppToast(
                `Access approved! Welcome to TownLoop, ${updatedUser.name}!`
              );
            }}
            onLogout={async () => {
              await logoutUser();
              setCurrentUser(null);
              setIsLoggedOut(true);
              setActiveTab('home');
              showAppToast('Signed out successfully');
            }}
          />
        ) : (
          <>
            {/* Ambient background glow for light mode matching sign-in page */}
            {!isDarkMode && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden -z-0">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-80 bg-gradient-to-b from-amber-200/25 via-emerald-100/30 to-transparent rounded-full blur-2xl" />
                <div className="absolute top-1/3 -right-16 w-72 h-72 bg-amber-100/30 rounded-full blur-3xl" />
              </div>
            )}

            {/* Header (Only shown when resident is logged in) */}
            <PortalHeader
              {...session}
              {...dates}
              {...notifications}
              onOpenAdminPanel={() => setIsAdminModalOpen(true)}
              onSwitchCommunity={handleSwitchCommunity}
            />

            {/* Main Content Area with Isolated Scroll Containers for Each Tab */}
            <main className="flex-1 relative w-full overflow-hidden">
              {/* ================= TAB 1: HOME ================= */}
              <div
                ref={homeScrollRef}
                onScroll={(e) => handleTabScroll('home', e.currentTarget.scrollTop)}
                className={
                  activeTab === 'home'
                    ? 'absolute inset-0 px-5 pt-4 pb-32 sm:pb-36 overflow-y-auto hide-scrollbar space-y-4'
                    : 'hidden'
                }
              >
                <HomeScreen
                  {...home}
                  {...dates}
                  onShowToast={showAppToast}
                />
              </div>

              {/* ================= TAB 2: NEWS ================= */}
              <div
                ref={newsScrollRef}
                onScroll={(e) => handleTabScroll('news', e.currentTarget.scrollTop)}
                className={
                  activeTab === 'news'
                    ? 'absolute inset-0 px-5 pt-4 pb-32 sm:pb-36 overflow-y-auto hide-scrollbar space-y-4'
                    : 'hidden'
                }
              >
                <NewsScreen
                  {...news}
                  {...dates}
                  currentUser={session.currentUser}
                  onShowToast={showAppToast}
                />
              </div>

              {/* ================= TAB 3: WORK ORDERS ================= */}
              <div
                ref={workOrdersScrollRef}
                onScroll={(e) => handleTabScroll('workorders', e.currentTarget.scrollTop)}
                className={
                  activeTab === 'workorders'
                    ? 'absolute inset-0 px-5 pt-4 pb-32 sm:pb-36 overflow-y-auto hide-scrollbar space-y-4'
                    : 'hidden'
                }
              >
                <WorkOrdersScreen
                  {...workOrders}
                  currentUser={session.currentUser}
                />
              </div>

              {/* ================= TAB 4: SOCIAL ================= */}
              <div
                ref={socialScrollRef}
                onScroll={(e) => handleTabScroll('social', e.currentTarget.scrollTop)}
                className={
                  activeTab === 'social'
                    ? 'absolute inset-0 px-5 pt-4 pb-32 sm:pb-36 overflow-y-auto hide-scrollbar space-y-4'
                    : 'hidden'
                }
              >
                <CommunityScreen {...community} />
              </div>
            </main>

            {/* Liquid Glass Dock */}
            <BottomNavigation
              setActiveTab={handleSelectTab}
              activeTab={activeTab}
            />
          </>
        )}

        <PortalModals
          home={home}
          dates={dates}
          workOrders={workOrders}
          news={news}
          community={community}
          notifications={notifications}
        />

        <AdminPanelModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          currentUser={currentUser}
          showToast={showAppToast}
        />
      </div>
    </div>
  );
}
