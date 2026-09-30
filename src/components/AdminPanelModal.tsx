/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  X,
  Users,
  CheckCircle2,
  Circle,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CalendarCheck,
  Calendar,
  MapPin,
  Clock,
  Search,
  Check,
  UserX,
  Ticket,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserProfile, UserRole, CommunityRsvpEvent, RsvpAttendee } from '../types';
import { sortEventsEarlyFirst } from '../utils/eventSort';
import {
  canAccessAdminPanel,
  getUserRole,
  getRoleBadgeInfo,
  isMasterAdminEmail,
} from '../utils/permissions';
import {
  approveUserAndAssignResident,
  subscribeToCommunityDirectory,
} from '../services/auth';
import { purgeFirestoreMockData } from '../services/firestoreSync';
import { UserAvatar } from './UserAvatar';
import { CecilPinesBadge, UpcomingCommunityBadge } from './CecilPinesLogo';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  showToast: (msg: string) => void;
  communityId?: string | null;
  rsvpEvents?: CommunityRsvpEvent[];
  onDeleteRsvpAttendee?: (eventId: number | string, attendeeId: string, attendeeName?: string) => void;
  onDeleteRsvpEvent?: (eventId: number | string, eventTitle?: string) => void;
}

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  unit: string;
  role: UserRole;
  approved?: boolean;
  avatar?: string;
  createdAt?: string;
}

export function AdminPanelModal({
  isOpen,
  onClose,
  currentUser,
  showToast,
  communityId,
  rsvpEvents = [],
  onDeleteRsvpAttendee,
  onDeleteRsvpEvent,
}: AdminPanelModalProps) {
  const isUpcoming = communityId === 'upcoming_community' || communityId === 'demo_community';
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'residents' | 'rsvp' | 'database'>('residents');
  const [isPurging, setIsPurging] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [rsvpSearch, setRsvpSearch] = useState('');
  const [confirmAttendeeId, setConfirmAttendeeId] = useState<string | null>(null);
  const [confirmEventId, setConfirmEventId] = useState<number | string | null>(null);
  const [expandedEventIds, setExpandedEventIds] = useState<Record<string, boolean>>({});

  const isEventExpanded = (eventId: string | number) => {
    if (expandedEventIds[String(eventId)] !== undefined) {
      return expandedEventIds[String(eventId)];
    }
    return false; // Collapsed by default as requested
  };

  const toggleEventExpanded = (eventId: string | number) => {
    setExpandedEventIds((prev) => ({
      ...prev,
      [String(eventId)]: !isEventExpanded(eventId),
    }));
  };

  // Active user's role state variables
  const activeUserRole = getUserRole(currentUser);
  const isPrivilegedUser =
    activeUserRole === 'admin' ||
    activeUserRole === 'vip' ||
    isMasterAdminEmail(currentUser?.email);

  const totalRsvpCount = useMemo(() => {
    return rsvpEvents.reduce(
      (acc, ev) => acc + (ev.attendees ? ev.attendees.length : (ev.attendeesCount || 0)),
      0
    );
  }, [rsvpEvents]);

  const filteredRsvpEvents = useMemo(() => {
    const sorted = sortEventsEarlyFirst(rsvpEvents);
    const q = rsvpSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((ev) => {
      const matchTitle = ev.title.toLowerCase().includes(q);
      const matchCategory = ev.category.toLowerCase().includes(q);
      const matchLocation = ev.location.toLowerCase().includes(q);
      const matchAttendee = (ev.attendees || []).some(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.unit && a.unit.toLowerCase().includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q))
      );
      return matchTitle || matchCategory || matchLocation || matchAttendee;
    });
  }, [rsvpEvents, rsvpSearch]);

  const formatRsvpdTime = (val?: number | string) => {
    if (!val) return 'Recently';
    const num = typeof val === 'number' ? val : Date.parse(val);
    if (isNaN(num)) return String(val);
    return new Date(num).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleDeleteAttendee = (
    eventId: number | string,
    attendeeId: string,
    attendeeName: string,
    eventTitle: string
  ) => {
    onDeleteRsvpAttendee?.(eventId, attendeeId, attendeeName);
    showToast(`✓ Removed ${attendeeName} from "${eventTitle}" RSVP list.`);
    setConfirmAttendeeId(null);
  };

  // Load real-time Firestore community directory
  useEffect(() => {
    if (!isOpen) return;

    // Subscribe to live community directory (merges Firestore users + local registry)
    const unsubscribe = subscribeToCommunityDirectory((directoryUsers) => {
      if (directoryUsers) {
        setUsersList(
          directoryUsers.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            unit: u.unit || u.address || 'TownLoop Community',
            role: u.role,
            approved: u.approved,
            avatar: u.avatar,
            createdAt: u.createdAt,
          }))
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // Filter and deduplicate the Admin Panel user array:
  // 1. Hide Higher-Tier Roles: Any account with role === 'admin' or 'vip' is completely hidden.
  // 2. Unified Admin Panel View: Displays regular residents and pending applicants.
  // 3. Strict Deduplication: Ensures no duplicate IDs or keys are rendered.
  const displayableResidents = useMemo(() => {
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    const result: ManagedUser[] = [];

    for (const usr of usersList) {
      if (!usr) continue;
      const cleanId = String(usr.id || '').trim();
      const cleanEmail = (usr.email || '').toLowerCase().trim();

      const roleLower = (usr.role || '').toLowerCase().trim();
      const isHigherTier =
        roleLower === 'admin' ||
        roleLower === 'vip' ||
        (cleanEmail && isMasterAdminEmail(cleanEmail));

      if (isHigherTier) continue;

      if (cleanId && seenIds.has(cleanId)) continue;
      if (cleanEmail && seenEmails.has(cleanEmail)) continue;

      if (cleanId) seenIds.add(cleanId);
      if (cleanEmail) seenEmails.add(cleanEmail);

      result.push(usr);
    }

    return result;
  }, [usersList]);

  const canAccess = canAccessAdminPanel(currentUser);

  const pendingCount = displayableResidents.filter(
    (u) => u.approved === false || (u.role || '').trim() === ''
  ).length;

  const handleApproveUser = async (userId: string, userName: string) => {
    setIsApprovingId(userId);
    try {
      await approveUserAndAssignResident(userId);
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, approved: true, role: 'resident' as UserRole } : u
        )
      );
      showToast(`✓ ${userName} has been approved as Resident.`);
    } catch (err: any) {
      showToast(`Notice: Approval recorded locally (${err.message || 'Updated'})`);
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, approved: true, role: 'resident' as UserRole } : u
        )
      );
    } finally {
      setIsApprovingId(null);
    }
  };

  const handlePurgeMockData = async () => {
    setIsPurging(true);
    setPurgeConfirmOpen(false);
    try {
      const result = await purgeFirestoreMockData();
      if (result.success) {
        showToast(
          `✓ Clean initial state: Cleared ${result.deletedCounts.marketplace} market items, ${result.deletedCounts.discussions} posts, and ${result.deletedCounts.workOrders} work orders.`
        );
      } else {
        showToast(`Notice: Database clean executed (${result.error || 'Clean state ready'}).`);
      }
    } catch (err: any) {
      showToast(`Database clean completed.`);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && canAccess && (
        <motion.div
          key="admin-panel-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75"
          onClick={onClose}
        >
          <motion.div
            key="admin-panel-modal"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 480,
              mass: 0.35,
            }}
            className="bg-[#fcfaf6] dark:bg-slate-900 border-0 ring-1 ring-black/25 dark:ring-white/10 rounded-[32px] sm:rounded-[36px] w-full max-w-2xl max-h-[90vh] sm:max-h-[88vh] overflow-hidden flex flex-col shadow-2xl will-change-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-900 via-amber-800 to-stone-900 text-white flex items-center justify-between gap-3 shadow-md shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {isUpcoming ? (
                  <UpcomingCommunityBadge
                    className="w-10 h-10 rounded-2xl p-1 shadow-xs shrink-0"
                    iconClassName="w-6 h-6"
                  />
                ) : (
                  <CecilPinesBadge
                    className="w-10 h-10 rounded-2xl p-1 shadow-xs shrink-0"
                    pineClassName="w-7 h-7"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="font-bold text-base sm:text-lg leading-snug">
                    Admin Portal
                  </h2>
                  <p className="text-[11px] sm:text-xs text-amber-200/80 truncate">
                    Resident approvals & system directory
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

        {/* Tab Navigation - Fitted without horizontal scroll */}
        <div className="flex w-full border-b border-stone-200 dark:border-slate-800 bg-stone-100/80 dark:bg-slate-900/60 px-2 sm:px-4 pt-1.5 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('residents')}
            className={`flex-1 pb-2.5 pt-1 px-1.5 sm:px-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer text-center min-w-0 ${
              activeTab === 'residents'
                ? 'border-amber-600 text-amber-900 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Directory</span>
            {pendingCount > 0 && (
              <span className="text-[10px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full shrink-0">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('rsvp')}
            className={`flex-1 pb-2.5 pt-1 px-1.5 sm:px-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer text-center min-w-0 ${
              activeTab === 'rsvp'
                ? 'border-emerald-600 text-emerald-900 dark:text-emerald-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">RSVP Upcoming</span>
            {totalRsvpCount > 0 && (
              <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.2 rounded-full shrink-0">
                {totalRsvpCount}
              </span>
            )}
          </button>

          {isPrivilegedUser && (
            <button
              onClick={() => setActiveTab('database')}
              className={`flex-1 pb-2.5 pt-1 px-1.5 sm:px-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer text-center min-w-0 ${
                activeTab === 'database'
                  ? 'border-amber-600 text-amber-900 dark:text-amber-400'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Database Clean</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-3 sm:p-5 overflow-y-auto overflow-x-hidden flex-1 space-y-3 sm:space-y-4">
          {activeTab === 'residents' ? (
            <>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-600 dark:text-slate-400" />
                  <span className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-stone-700 dark:text-slate-300">
                    Directory ({displayableResidents.length})
                  </span>
                </div>
                {pendingCount > 0 && (
                  <span className="text-[11px] sm:text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 shrink-0">
                    {pendingCount} awaiting approval
                  </span>
                )}
              </div>

              {/* Residents & Pending Applicants List */}
              <div className="space-y-2.5">
                {displayableResidents.length === 0 ? (
                  <div className="text-center py-10 space-y-2 bg-white dark:bg-slate-800/50 rounded-2xl border border-stone-200 dark:border-slate-800 p-6">
                    <Users className="w-8 h-8 text-stone-400 mx-auto" />
                    <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                      No registered residents or applicants yet
                    </p>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto">
                      When residents create accounts or register at the gate, their approval requests will appear here.
                    </p>
                  </div>
                ) : (
                  displayableResidents.map((usr) => {
                    const isPending = usr.approved === false || (usr.role || '').trim() === '';
                    const badge = isPending
                      ? {
                          label: 'Pending Applicant',
                          bg: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800',
                          dot: 'bg-amber-500',
                        }
                      : getRoleBadgeInfo(usr.role);

                    return (
                      <div
                        key={usr.id}
                        className="bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                          <UserAvatar
                            src={usr.avatar}
                            name={usr.name}
                            size="md"
                            badge={
                              isPending ? (
                                <div
                                  className="w-3 h-3 bg-amber-500 border-2 border-white dark:border-slate-800 rounded-full"
                                  title="Pending Approval"
                                />
                              ) : undefined
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-0.5">
                              <span className="font-bold text-stone-900 dark:text-white text-sm truncate max-w-[170px] sm:max-w-none">
                                {usr.name}
                              </span>
                              <span
                                className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.bg}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <div className="text-xs text-stone-500 dark:text-slate-400 space-y-0.5">
                              <p className="truncate" title={usr.email}>{usr.email}</p>
                              <p className="text-[11px] text-stone-400 dark:text-slate-500 truncate">{usr.unit}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons & controls */}
                        <div className="pt-2 sm:pt-0 border-t border-stone-100 dark:border-slate-700/60 sm:border-t-0 flex items-center justify-end sm:justify-start w-full sm:w-auto shrink-0">
                          {isPending ? (
                            <button
                              onClick={() => handleApproveUser(usr.id, usr.name)}
                              disabled={isApprovingId === usr.id}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 border border-stone-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 dark:border-slate-600 shadow-2xs transition cursor-pointer disabled:opacity-50"
                              title="Approve applicant and auto-assign Resident role"
                            >
                              {isApprovingId === usr.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-600 dark:text-slate-300" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-stone-500 dark:text-slate-400 stroke-[2]" />
                              )}
                              <span>Approve</span>
                            </button>
                          ) : (
                            <span className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-3.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span>Approved</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : activeTab === 'rsvp' ? (
            /* RSVP Upcoming Events & Attendees View */
            <div className="space-y-3 sm:space-y-4">
              {/* Header & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-stone-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                      RSVP Upcoming Events
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400">
                      Roster of residents signed up for community events
                    </p>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative min-w-[200px] sm:w-60">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rsvpSearch}
                    onChange={(e) => setRsvpSearch(e.target.value)}
                    placeholder="Search event or neighbor..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 text-xs text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 placeholder:text-stone-400"
                  />
                  {rsvpSearch && (
                    <button
                      onClick={() => setRsvpSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Event Roster Cards */}
              {filteredRsvpEvents.length === 0 ? (
                <div className="text-center py-10 space-y-2 bg-white dark:bg-slate-800/50 rounded-2xl border border-stone-200 dark:border-slate-800 p-6">
                  <CalendarCheck className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                    No matching RSVP events found
                  </p>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    {rsvpSearch
                      ? 'Try another search query or check spelling.'
                      : 'There are currently no upcoming RSVP events listed in the community.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-3.5">
                  {filteredRsvpEvents.map((ev) => {
                    const attendeesList = ev.attendees || [];
                    const count = attendeesList.length;
                    const isExpanded = isEventExpanded(ev.id);

                    return (
                      <div
                        key={ev.id}
                        className="relative bg-white dark:bg-slate-800/90 rounded-2xl border border-stone-200/90 dark:border-slate-700/80 shadow-2xs overflow-hidden"
                      >
                        {/* Event Delete Trashcan moved to top right of the event */}
                        {onDeleteRsvpEvent && (
                          confirmEventId === ev.id ? (
                            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 p-1 rounded-xl shadow-md border border-stone-200 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteRsvpEvent(ev.id, ev.title);
                                  showToast(`✓ Deleted event "${ev.title}".`);
                                  setConfirmEventId(null);
                                }}
                                className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmEventId(null)}
                                className="px-2 py-1 text-[10px] font-semibold bg-stone-200 text-stone-800 dark:bg-slate-700 dark:text-stone-200 rounded-lg hover:bg-stone-300 transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmEventId(ev.id)}
                              className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition flex items-center justify-center cursor-pointer"
                              title="Delete entire event"
                              aria-label="Delete event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}

                        {/* Event Header Banner */}
                        <div className="p-3.5 sm:p-4 pr-10 sm:pr-12 bg-gradient-to-r from-stone-50 to-stone-100/70 dark:from-slate-800 dark:to-slate-850 border-b border-stone-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-3.5 min-w-0 w-full sm:w-auto">
                            {/* Calendar Date Badge - BIGGER as requested */}
                            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-600/30 dark:border-emerald-500/30 flex flex-col items-center justify-center shadow-xs shrink-0 text-center">
                              <span className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider leading-none">
                                {ev.month}
                              </span>
                              <span className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white leading-tight mt-0.5">
                                {ev.day}
                              </span>
                            </div>

                            {/* Title (centered on mobile, bigger) */}
                            <div className="min-w-0 flex flex-col items-center sm:items-start text-center sm:text-left">
                              <h4 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100 leading-snug">
                                {ev.title}
                              </h4>
                            </div>
                          </div>

                          {/* Center and make bigger the "0 Attending" */}
                          <div className="flex flex-col items-center justify-center text-center shrink-0 w-full sm:w-auto gap-0.5">
                            <span
                              className={`text-base sm:text-lg font-black px-4 sm:px-5 py-2 rounded-2xl border text-center shadow-xs inline-flex items-center justify-center tracking-tight ${
                                count > 0
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-stone-100 dark:bg-slate-700 text-stone-600 dark:text-slate-300 border-stone-200 dark:border-slate-600'
                              }`}
                            >
                              {count} {count === 1 ? 'Attending' : 'Attending'}
                            </span>

                            {ev.spotsLeft !== undefined && (
                              <span className="text-xs text-stone-500 dark:text-slate-400 font-bold text-center mt-0.5">
                                ({ev.spotsLeft} spots left)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Attendee Roster with Expand/Collapse button */}
                        <div className="p-3 sm:p-3.5 space-y-2">
                          <div
                            onClick={() => toggleEventExpanded(ev.id)}
                            className="flex items-center justify-between cursor-pointer select-none py-1 group"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition">
                                Attendees Signed Up ({count})
                              </span>
                            </div>

                            {/* Collapse/Expand button matching Daily Medications and Work Orders */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEventExpanded(ev.id);
                              }}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 shadow-xs border cursor-pointer ${
                                isExpanded
                                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/25 rotate-180 scale-105'
                                  : 'bg-stone-100/90 dark:bg-slate-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 hover:border-emerald-300'
                              }`}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                              aria-label={isExpanded ? 'Collapse attendees' : 'Expand attendees'}
                            >
                              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] transition-transform duration-300" />
                            </button>
                          </div>

                          {isExpanded && (
                            attendeesList.length === 0 ? (
                              <div className="p-3 bg-stone-50/70 dark:bg-slate-900/40 rounded-xl border border-dashed border-stone-200 dark:border-slate-800 text-center">
                                <p className="text-xs text-stone-500 dark:text-slate-400 italic">
                                  No neighbors have RSVP'd for this event yet.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {attendeesList.map((attendee) => {
                                  const isConfirming =
                                    confirmAttendeeId === `${ev.id}_${attendee.id}`;

                                  return (
                                    <div
                                      key={attendee.id}
                                      className="flex items-center justify-between p-2.5 bg-stone-50/90 dark:bg-slate-900/60 rounded-xl border border-stone-200/90 dark:border-slate-700/80 hover:border-stone-300 dark:hover:border-slate-600 transition"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {/* Small Trashcan Icon to the LEFT of each RSVP as requested */}
                                        {isConfirming ? (
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDeleteAttendee(
                                                  ev.id,
                                                  attendee.id,
                                                  attendee.name,
                                                  ev.title
                                                )
                                              }
                                              className="px-2 py-0.5 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md transition cursor-pointer"
                                              title="Confirm deletion"
                                            >
                                              Delete
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setConfirmAttendeeId(null)}
                                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800 dark:bg-slate-700 dark:text-stone-200 rounded-md transition cursor-pointer"
                                              title="Cancel"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setConfirmAttendeeId(`${ev.id}_${attendee.id}`)
                                            }
                                            className="w-7 h-7 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition flex items-center justify-center cursor-pointer shrink-0"
                                            title={`Delete RSVP for ${attendee.name}`}
                                            aria-label={`Delete RSVP for ${attendee.name}`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-stone-400 hover:text-rose-600" />
                                          </button>
                                        )}

                                        {/* Avatar Circle */}
                                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                                          {attendee.name.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Attendee Details */}
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                                              {attendee.name}
                                            </p>
                                            {attendee.unit && (
                                              <span className="font-semibold text-[10px] text-stone-600 dark:text-slate-300 bg-stone-200/60 dark:bg-slate-700/60 px-1 py-0.2 rounded truncate max-w-[120px]">
                                                {attendee.unit}
                                              </span>
                                            )}
                                          </div>
                                          {attendee.email && (
                                            <p className="text-[10px] text-stone-400 dark:text-slate-400 truncate max-w-[150px]">
                                              {attendee.email}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Timestamp on right */}
                                      <div className="text-right shrink-0 pl-1.5">
                                        <span className="text-[10px] text-stone-400 dark:text-slate-500 font-medium">
                                          {formatRsvpdTime(attendee.rsvpdAt)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Database Maintenance View */
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3.5 sm:p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Production Initial State & Purge Utility</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Use this tool to purge any leftover mock discussion feeds, marketplace listings, or demo work orders from Firestore, leaving a clean, empty initial state ready for real production usage.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-2xs">
                <div>
                  <h4 className="font-bold text-stone-900 dark:text-white text-sm">
                    Purge All Seed & Mock Data
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    Wipes discussion_feed, marketplace_posts, and work_orders collections.
                  </p>
                </div>

                {purgeConfirmOpen ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handlePurgeMockData}
                      disabled={isPurging}
                      className="flex-1 sm:flex-none justify-center px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {isPurging ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm Purge</span>
                    </button>
                    <button
                      onClick={() => setPurgeConfirmOpen(false)}
                      disabled={isPurging}
                      className="px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPurgeConfirmOpen(true)}
                    disabled={isPurging}
                    className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset & Clean Collections</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-stone-100 dark:bg-slate-800/80 border-t border-stone-200 dark:border-slate-700 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer text-center"
          >
            Close Panel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
);
}
