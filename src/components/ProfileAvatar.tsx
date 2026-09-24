/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Phone,
  Home,
  Heart,
  Shield,
  X,
  Mail,
  Users,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Send,
  Wrench,
  Building2,
  MessageSquare,
  Search,
  CheckCircle2,
  Copy,
  Calendar,
  Sparkles,
  Camera,
  Upload,
  Image as ImageIcon,
  Check,
  RefreshCw
} from 'lucide-react';
import { UserProfile } from '../types';
import { updateResidentProfile, subscribeToCommunityDirectory } from '../services/auth';
import { canAccessAdminPanel, getUserRole, getRoleBadgeInfo, isCrew, isStrictVip, isAdmin } from '../utils/permissions';
import { UserAvatar } from './UserAvatar';
import { CrewShieldBadge } from './CrewShieldBadge';
import { VipStaffBadge } from './VipStaffBadge';

interface ProfileAvatarProps {
  apartmentNumber?: string;
  residentName?: string;
  currentUser?: UserProfile | null;
  size?: 'normal' | 'large';
  isDarkMode?: boolean;
  onToggleTheme?: (dark: boolean) => void;
  onLogout?: () => void;
  onUpdateProfile?: (updated: UserProfile) => void;
  onOpenAdminPanel?: () => void;
  onSwitchCommunity?: () => void;
}

export type MessageCategory = 'friend' | 'office' | 'maintenance';

export interface InboxMessage {
  id: number;
  from: string;
  senderCategory: MessageCategory;
  role: string;
  subject: string;
  body: string;
  time: string;
  unread: boolean;
  senderAvatar?: string;
  senderPhone?: string;
  senderApt?: string;
}

export interface ResidentFriend {
  id: number;
  name: string;
  apt: string;
  wing: string;
  phone: string;
  address: string;
  status: 'online' | 'recent' | 'offline';
  photo: string;
  residentSince: string;
  interests: string[];
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  apartmentNumber = '',
  residentName = 'Resident',
  currentUser,
  size = 'normal',
  isDarkMode = false,
  onToggleTheme,
  onLogout,
  onUpdateProfile,
  onOpenAdminPanel,
  onSwitchCommunity,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<
    'menu' | 'inbox' | 'friends' | 'friendDetail' | 'compose' | 'account' | 'logoutConfirm'
  >('menu');
  const [internalDarkMode, setInternalDarkMode] = useState(isDarkMode);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Direct Profile Photo Upload State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  // Filter for Inbox (All, Friends, Community Office, Maintenance Crew)
  const [inboxFilter, setInboxFilter] = useState<'all' | MessageCategory>('all');
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);

  // Friends Directory State
  const [friendSearch, setFriendSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<ResidentFriend | null>(null);

  // Compose State
  const [composeRecipient, setComposeRecipient] = useState<{
    name: string;
    category: MessageCategory;
    role?: string;
    apt?: string;
    phone?: string;
  }>({
    name: 'Clara Higgins',
    category: 'friend',
    apt: 'Apt 204'
  });
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  useEffect(() => {
    setInternalDarkMode(isDarkMode);
  }, [isDarkMode]);

  // High quality warm portrait of resident
  const effectiveName = currentUser?.name || residentName || 'Resident';
  const effectiveAddress = currentUser?.address || currentUser?.unit || 'TownLoop Community';
  const effectiveWing = currentUser?.wing || '';
  const effectiveEmail = currentUser?.email || '';
  const effectivePhone = currentUser?.phone || '';
  const effectiveEmergency = currentUser?.emergencyContact || currentUser?.emergency_contact || '';
  const effectiveDietary = currentUser?.dietaryPreference || currentUser?.dietary_preference || '';
  const profilePhotoUrl =
    currentUser?.avatar_url ||
    currentUser?.avatarUrl ||
    '';

  const handleDirectPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file (JPG, PNG, WebP)');
      return;
    }
    setIsSavingPhoto(true);
    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 320;
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');
          let dataUrl = event.target?.result as string;
          if (ctx) {
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxDim, maxDim);
            dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          }
          const updated = await updateResidentProfile({
            avatar_url: dataUrl,
            avatarUrl: dataUrl
          });
          onUpdateProfile?.(updated);
          showToast('Profile picture updated!');
        } catch (err) {
          console.error('Failed to update profile photo:', err);
          showToast('Could not save photo. Please try again.');
        } finally {
          setIsSavingPhoto(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isLarge = size === 'large';

  // Dynamic list of community residents
  const [residents, setResidents] = useState<ResidentFriend[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToCommunityDirectory((users) => {
      if (users) {
        const mapped: ResidentFriend[] = users
          .filter(u => u.email !== currentUser?.email)
          .map((u, idx) => ({
            id: idx + 1,
            name: u.name || 'Neighbor',
            apt: u.unit || u.address || 'TownLoop Resident',
            wing: u.wing || '',
            phone: u.phone || '',
            address: u.address || u.unit || 'TownLoop Community',
            status: 'online',
            photo: u.avatar || '',
            residentSince: u.createdAt ? String(new Date(u.createdAt).getFullYear()) : '2024',
            interests: u.interests || ['Community'],
          }));
        setResidents(mapped);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [currentUser?.email]);

  // Messages in Inbox: Friends, Community Office, and Maintenance Crew
  const [messages, setMessages] = useState<InboxMessage[]>([]);

  const unreadCount = messages.filter(m => m.unread).length;

  useEffect(() => {
    const handleNewMail = (e: Event) => {
      const customEvent = e as CustomEvent<InboxMessage>;
      if (customEvent.detail) {
        setMessages(prev => [customEvent.detail, ...prev]);
      }
    };
    window.addEventListener('cecil-new-mail', handleNewMail);
    return () => {
      window.removeEventListener('cecil-new-mail', handleNewMail);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleToggleTheme = (dark: boolean) => {
    setInternalDarkMode(dark);
    if (onToggleTheme) {
      onToggleTheme(dark);
    }
    showToast(dark ? 'Dark theme activated' : 'Light theme activated');
  };

  const markMessageAsRead = (id: number) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, unread: false } : m)));
  };

  const handleStartComposeToFriend = (friend: ResidentFriend) => {
    setComposeRecipient({
      name: friend.name,
      category: 'friend',
      role: `Resident (${friend.apt})`,
      apt: friend.apt,
      phone: friend.phone
    });
    setComposeSubject(`Hello ${friend.name.split(' ')[0]}!`);
    setComposeBody('');
    setActiveView('compose');
  };

  const handleStartComposeToOffice = () => {
    setComposeRecipient({
      name: 'Community Office',
      category: 'office',
      role: 'Concierge & Front Office',
      apt: 'Clubhouse Office',
      phone: '(904) 555-0100'
    });
    setComposeSubject('Resident Inquiry');
    setComposeBody('');
    setActiveView('compose');
  };

  const handleStartComposeToMaintenance = () => {
    setComposeRecipient({
      name: 'Maintenance Crew',
      category: 'maintenance',
      role: 'Facilities & Repairs',
      apt: 'Maintenance Depot',
      phone: '(904) 555-0105'
    });
    setComposeSubject('Maintenance Service Request');
    setComposeBody('');
    setActiveView('compose');
  };

  const handleSendComposedMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeBody.trim()) {
      showToast('Please type a message before sending');
      return;
    }

    const newMessage: InboxMessage = {
      id: Date.now(),
      from: composeRecipient.name,
      senderCategory: composeRecipient.category,
      role: composeRecipient.role || 'Resident',
      subject: composeSubject.trim() || 'Conversation',
      body: `You: "${composeBody.trim()}"`,
      time: 'Just now',
      unread: false,
      senderPhone: composeRecipient.phone,
      senderApt: composeRecipient.apt
    };

    setMessages(prev => [newMessage, ...prev]);
    showToast(`Message sent to ${composeRecipient.name}!`);
    setComposeBody('');
    setComposeSubject('');
    setActiveView('inbox');
  };

  const handleLogout = () => {
    setIsOpen(false);
    setActiveView('menu');
    if (onLogout) {
      onLogout();
    } else {
      showToast('Logged out safely');
    }
  };

  // Filtered Messages
  const filteredMessages = messages.filter(msg => {
    if (inboxFilter === 'all') return true;
    return msg.senderCategory === inboxFilter;
  });

  // Filtered Residents
  const filteredResidents = residents.filter(resident => {
    const q = friendSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      resident.name.toLowerCase().includes(q) ||
      resident.apt.toLowerCase().includes(q) ||
      resident.wing.toLowerCase().includes(q) ||
      resident.interests.some(i => i.toLowerCase().includes(q))
    );
  });

  const modalMarkup = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-avatar-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 bg-stone-950/75 z-[100] flex items-center justify-center p-3 sm:p-5"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <motion.div
            key="profile-avatar-window"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 480,
              mass: 0.35,
            }}
            className={`w-full max-w-[500px] sm:max-w-[540px] max-h-[92vh] sm:max-h-[90vh] rounded-[32px] sm:rounded-[36px] p-5 sm:p-6 shadow-2xl border relative flex flex-col will-change-transform ${
              internalDarkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className={`absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition cursor-pointer z-10 ${
            internalDarkMode
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-stone-100 hover:bg-stone-200 text-stone-500'
          }`}
          aria-label="Close Resident Menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Toast Notification inside modal */}
        {toastMessage && (
          <div className="absolute top-4 left-5 right-16 bg-emerald-600 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-md text-center animate-in fade-in slide-in-from-top-2 duration-200 z-30">
            {toastMessage}
          </div>
        )}

        {/* Inner Scrollable Container */}
        <div className="overflow-y-auto hide-scrollbar flex-1 pr-0.5 space-y-4">
          {/* ================= VIEW 1: MAIN MENU ================= */}
          {activeView === 'menu' && (
            <div className="space-y-4">
              {/* Profile Header Card */}
              <div className="flex items-center gap-3.5 pt-0.5">
                <div className="relative shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDirectPhotoUpload}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-emerald-600/50 shadow-sm group cursor-pointer"
                    title="Upload profile picture"
                  >
                    <UserAvatar
                      src={profilePhotoUrl}
                      name={effectiveName}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                      <Camera className="w-5 h-5 drop-shadow" />
                    </div>
                  </div>
                  {/* Camera button on the picture itself to directly upload */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSavingPhoto}
                    className="absolute -bottom-0.5 -right-0.5 w-6 h-6 sm:w-7 sm:h-7 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md transition cursor-pointer"
                    title="Upload profile picture"
                    aria-label="Upload profile picture"
                  >
                    {isSavingPhoto ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="min-w-0 pr-8">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight serif-title leading-snug truncate">
                      {effectiveName}
                    </h3>
                  </div>
                  {(() => {
                    const role = getUserRole(currentUser);
                    const badge = getRoleBadgeInfo(role);
                    return (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 dark:bg-emerald-950/80 dark:text-emerald-300 inline-block px-3 py-1 rounded-full border border-emerald-200/70 dark:border-emerald-800/60 truncate max-w-full">
                      {effectiveAddress}{effectiveWing ? ` • ${effectiveWing}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-stone-400 dark:text-slate-400 mt-1 truncate">
                    {effectiveEmail}
                  </p>
                </div>
              </div>

              {/* The Main Menu Items: Admin Panel (if admin), Mail, Friends, Account, Theme, Log Out */}
              <div className="space-y-2.5 pt-1">
                {/* 0. MASTER ADMIN PANEL (If Admin) */}
                {canAccessAdminPanel(currentUser) && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAdminPanel?.();
                    }}
                    className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border-amber-300 dark:border-amber-700/60 hover:border-amber-400"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200 leading-snug">
                            Admin Panel
                          </p>
                        </div>
                        <p className="text-xs sm:text-[13px] text-amber-800/80 dark:text-amber-300/80">
                          Resident Approvals & Role Management
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-amber-600 shrink-0" />
                  </button>
                )}

                {/* 1. MAIL (INBOX) */}
                <button
                  onClick={() => {
                    setSelectedMessage(null);
                    setActiveView('inbox');
                  }}
                  className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left ${
                    internalDarkMode
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80'
                      : 'bg-[#faf8f5] hover:bg-[#f3efe8] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold leading-snug">Mail (Inbox)</p>
                      <p className="text-xs sm:text-[13px] text-stone-500 dark:text-slate-400">
                        Friends, Community Office & Crew
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {unreadCount > 0 && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-2xs">
                        {unreadCount} new
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-stone-400" />
                  </div>
                </button>

                {/* 2. FRIENDS */}
                <button
                  onClick={() => {
                    setSelectedResident(null);
                    setActiveView('friends');
                  }}
                  className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left ${
                    internalDarkMode
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80'
                      : 'bg-[#faf8f5] hover:bg-[#f3efe8] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold leading-snug">Friends & Residents</p>
                      <p className="text-xs sm:text-[13px] text-stone-500 dark:text-slate-400">
                        All {residents.length} neighbors • Profiles & phone
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-400 shrink-0" />
                </button>

                {/* 3. ACCOUNT */}
                <button
                  onClick={() => setActiveView('account')}
                  className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left ${
                    internalDarkMode
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80'
                      : 'bg-[#faf8f5] hover:bg-[#f3efe8] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold leading-snug">Account</p>
                      <p className="text-xs sm:text-[13px] text-stone-500 dark:text-slate-400">
                        Residency details & contacts
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-400 shrink-0" />
                </button>

                {/* 4. THEME (LIGHT AND DARK) */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border ${
                    internalDarkMode
                      ? 'bg-slate-800/80 border-slate-700/80'
                      : 'bg-[#faf8f5] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      {internalDarkMode ? (
                        <Moon className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Sun className="w-5 h-5 text-amber-500" />
                      )}
                      <span className="text-sm font-bold">Theme</span>
                    </div>
                    <span className="text-xs font-semibold text-stone-500 dark:text-slate-400 capitalize">
                      {internalDarkMode ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </div>

                  {/* Segmented Light / Dark Switcher */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-stone-200/80 dark:bg-slate-900 border border-stone-300/60 dark:border-slate-700">
                    <button
                      onClick={() => handleToggleTheme(false)}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                        !internalDarkMode
                          ? 'bg-white text-stone-900 shadow-xs ring-1 ring-stone-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Light</span>
                    </button>

                    <button
                      onClick={() => handleToggleTheme(true)}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                        internalDarkMode
                          ? 'bg-slate-800 text-white shadow-xs ring-1 ring-slate-700'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                {/* 5. SWITCH COMMUNITY */}
                {onSwitchCommunity && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSwitchCommunity();
                    }}
                    className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left ${
                      internalDarkMode
                        ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                        : 'bg-[#faf8f5] hover:bg-stone-100/90 border-stone-200/70 text-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <p className="text-sm sm:text-base font-bold leading-snug">Switch Community</p>
                        <p className="text-xs sm:text-[13px] text-stone-500 dark:text-slate-400">
                          Return to community selection screen
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-stone-400 shrink-0" />
                  </button>
                )}

                {/* 6. LOG OUT */}
                <button
                  onClick={() => setActiveView('logoutConfirm')}
                  className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left text-rose-600 dark:text-rose-400 ${
                    internalDarkMode
                      ? 'bg-rose-950/20 hover:bg-rose-950/40 border-rose-900/40'
                      : 'bg-rose-50/60 hover:bg-rose-100/70 border-rose-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                      <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold leading-snug">Log Out</p>
                      <p className="text-xs sm:text-[13px] text-rose-500/80 dark:text-rose-400/80">
                        Sign out of TownLoop portal
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-rose-400 shrink-0" />
                </button>

                {/* About App / Version & Copyright Notice */}
                <div className="pt-2 pb-1 text-center">
                  <p className="text-[11px] font-medium text-stone-400 dark:text-slate-500">
                    Version 1.0.0 • © 2026 TownLoop • All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW 2: MAIL (INBOX) ================= */}
          {activeView === 'inbox' && !selectedMessage && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 pr-11 sm:pr-12">
                <button
                  onClick={() => setActiveView('menu')}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-800 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 transition cursor-pointer py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <div className="text-center">
                  <span className="text-sm sm:text-base font-black text-stone-950 dark:text-white tracking-tight">
                    Mail (Inbox)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setMessages(prev => prev.map(m => ({ ...m, unread: false })));
                    showToast('All messages marked read');
                  }}
                  className="text-xs font-semibold text-stone-600 hover:text-stone-900 dark:text-slate-300 dark:hover:text-white shrink-0"
                >
                  Mark all read
                </button>
              </div>

              {/* 3 Categories Filter Tabs: Friends, Community Office, Maintenance Crew */}
              <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-stone-100 border border-stone-200/90 text-xs sm:text-sm font-bold shadow-xs">
                <button
                  onClick={() => setInboxFilter('all')}
                  className={`py-2 px-1 rounded-xl transition text-center cursor-pointer ${
                    inboxFilter === 'all'
                      ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setInboxFilter('friend')}
                  className={`py-2 px-1 rounded-xl transition text-center cursor-pointer ${
                    inboxFilter === 'friend'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  Friends
                </button>
                <button
                  onClick={() => setInboxFilter('office')}
                  className={`py-2 px-1 rounded-xl transition text-center cursor-pointer ${
                    inboxFilter === 'office'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  Office
                </button>
                <button
                  onClick={() => setInboxFilter('maintenance')}
                  className={`py-2 px-1 rounded-xl transition text-center cursor-pointer ${
                    inboxFilter === 'maintenance'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  Crew
                </button>
              </div>

              {/* Messages List - Longer height so more items show */}
              <div className="space-y-2.5 max-h-[380px] sm:max-h-[440px] overflow-y-auto pr-1">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 dark:text-slate-500 space-y-2">
                    <Mail className="w-10 h-10 mx-auto opacity-40" />
                    <p className="text-sm">No messages in this folder.</p>
                  </div>
                ) : (
                  filteredMessages.map(msg => (
                    <div
                      key={msg.id}
                      onClick={() => {
                        markMessageAsRead(msg.id);
                        setSelectedMessage(msg);
                      }}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left group ${
                        msg.unread
                          ? internalDarkMode
                            ? 'bg-slate-800/90 border-blue-500/50 shadow-xs'
                            : 'bg-blue-50/60 border-blue-200/80 shadow-xs'
                          : internalDarkMode
                          ? 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70'
                          : 'bg-[#faf8f5] border-stone-200/70 hover:bg-[#f3efe8]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          {/* Sender Category Tag / Icon */}
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              msg.senderCategory === 'friend'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : msg.senderCategory === 'office'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {msg.senderCategory === 'friend' && <Users className="w-4 h-4" />}
                            {msg.senderCategory === 'office' && <Building2 className="w-4 h-4" />}
                            {msg.senderCategory === 'maintenance' && <Wrench className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold leading-tight truncate">{msg.from}</p>
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  msg.senderCategory === 'friend'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                    : msg.senderCategory === 'office'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                }`}
                              >
                                {msg.senderCategory === 'friend'
                                  ? 'Friend'
                                  : msg.senderCategory === 'office'
                                  ? 'Office'
                                  : 'Crew'}
                              </span>
                            </div>
                            <p className="text-xs text-stone-500 dark:text-slate-400 truncate mt-0.5">
                              {msg.role}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-stone-400 dark:text-slate-500">
                            {msg.time}
                          </span>
                          {msg.unread && (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold mt-2.5 text-stone-900 dark:text-white leading-snug line-clamp-1">
                        {msg.subject}
                      </h4>
                      <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {msg.body}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Compose New Message Shortcuts */}
              <div className="pt-1 flex gap-2">
                <button
                  onClick={handleStartComposeToOffice}
                  className="flex-1 py-2.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Msg Office</span>
                </button>

                <button
                  onClick={handleStartComposeToMaintenance}
                  className="flex-1 py-2.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Msg Crew</span>
                </button>

                <button
                  onClick={() => setActiveView('friends')}
                  className="flex-1 py-2.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  <span>Msg Friend</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= VIEW 2B: SINGLE MESSAGE DETAIL ================= */}
          {activeView === 'inbox' && selectedMessage && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                  All Messages
                </button>
                <span
                  className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                    selectedMessage.senderCategory === 'friend'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : selectedMessage.senderCategory === 'office'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}
                >
                  {selectedMessage.senderCategory === 'friend'
                    ? 'Friend'
                    : selectedMessage.senderCategory === 'office'
                    ? 'Community Office'
                    : 'Maintenance Crew'}
                </span>
              </div>

              {/* Message Header */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
                  internalDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-[#faf8f5] border-stone-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedMessage.senderAvatar ? (
                      <img
                        src={selectedMessage.senderAvatar}
                        alt={selectedMessage.from}
                        className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500/40"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm ${
                          selectedMessage.senderCategory === 'office'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {selectedMessage.senderCategory === 'office' ? (
                          <Building2 className="w-5 h-5" />
                        ) : (
                          <Wrench className="w-5 h-5" />
                        )}
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm sm:text-base font-bold">{selectedMessage.from}</h4>
                      <p className="text-xs text-stone-500 dark:text-slate-400">
                        {selectedMessage.role}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-stone-400 font-medium">{selectedMessage.time}</span>
                </div>

                <div className="pt-1">
                  <h3 className="text-base sm:text-lg font-black serif-title text-stone-900 dark:text-white">
                    {selectedMessage.subject}
                  </h3>
                  <p className="text-sm sm:text-base text-stone-700 dark:text-slate-200 mt-2.5 leading-relaxed whitespace-pre-wrap">
                    {selectedMessage.body}
                  </p>
                </div>

                {selectedMessage.senderPhone && (
                  <div className="pt-2.5 border-t border-stone-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-stone-600 dark:text-slate-300 flex items-center gap-2 font-medium">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      {selectedMessage.senderPhone}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText?.(selectedMessage.senderPhone || '');
                        showToast(`Copied ${selectedMessage.senderPhone}`);
                      }}
                      className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      Copy phone
                    </button>
                  </div>
                )}
              </div>

              {/* Reply Button */}
              <button
                onClick={() => {
                  setComposeRecipient({
                    name: selectedMessage.from,
                    category: selectedMessage.senderCategory,
                    role: selectedMessage.role,
                    phone: selectedMessage.senderPhone,
                    apt: selectedMessage.senderApt
                  });
                  setComposeSubject(`Re: ${selectedMessage.subject}`);
                  setComposeBody('');
                  setActiveView('compose');
                }}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>Reply to {selectedMessage.from}</span>
              </button>
            </div>
          )}

          {/* ================= VIEW 3: ALL RESIDENTS & FRIENDS ================= */}
          {activeView === 'friends' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200/90 dark:border-slate-800 pr-11 sm:pr-12">
                <button
                  onClick={() => setActiveView('menu')}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-800 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 transition cursor-pointer py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-stone-950 dark:text-white tracking-tight truncate">
                    Friends & Residents
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700 shrink-0">
                    {residents.length} neighbors
                  </span>
                </div>
              </div>

              {/* Search Bar for Residents */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search resident name, apt, or wing..."
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition ${
                    internalDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-[#faf8f5] border-stone-200 text-stone-900 placeholder:text-stone-400'
                  }`}
                />
              </div>

              {/* Notice that tapping a resident shows phone number and address */}
              <p className="text-xs text-stone-500 dark:text-slate-400 text-center">
                Tap on any resident to view phone number, address & profile.
              </p>

              {/* Residents List - Longer view so residents can browse smoothly */}
              <div className="space-y-2.5 max-h-[380px] sm:max-h-[440px] overflow-y-auto pr-1">
                {filteredResidents.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 dark:text-slate-500 space-y-2">
                    <Users className="w-10 h-10 mx-auto opacity-40" />
                    <p className="text-sm font-semibold">No residents found in directory.</p>
                    <p className="text-xs text-stone-400">Registered community members will appear here.</p>
                  </div>
                ) : (
                  filteredResidents.map(resident => (
                    <div
                      key={resident.id}
                      onClick={() => {
                        setSelectedResident(resident);
                        setActiveView('friendDetail');
                      }}
                      className={`p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between transition cursor-pointer group ${
                        internalDarkMode
                          ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80'
                          : 'bg-[#faf8f5] hover:bg-[#f3efe8] border-stone-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-emerald-600/40 shadow-xs">
                            <UserAvatar
                              src={resident.photo}
                              name={resident.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                          </div>
                          {resident.status === 'online' && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full shadow-xs ring-1 ring-emerald-600/30"
                              title="Online now"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base font-bold truncate leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                            {resident.name}
                          </p>
                          <p className="text-xs sm:text-[13px] text-stone-500 dark:text-slate-400 truncate mt-0.5">
                            {resident.apt} • {resident.wing}
                          </p>
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 mt-0.5">
                            {resident.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Send message button directly from list */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleStartComposeToFriend(resident);
                          }}
                          className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs transition cursor-pointer border border-emerald-200/70 dark:border-emerald-800"
                          title={`Message ${resident.name}`}
                          aria-label={`Message ${resident.name}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-stone-700 dark:group-hover:text-white transition" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= VIEW 3B: RESIDENT PROFILE DETAIL (PHONE & ADDRESS) ================= */}
          {activeView === 'friendDetail' && selectedResident && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200/90 dark:border-slate-800 pr-11 sm:pr-12">
                <button
                  onClick={() => setActiveView('friends')}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-800 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 transition cursor-pointer py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>All Residents</span>
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-stone-950 dark:text-white tracking-tight truncate">
                    Resident Profile
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700 shrink-0">
                    {selectedResident.status === 'online' ? 'Online' : 'Active'}
                  </span>
                </div>
              </div>

              {/* Resident Profile Hero Card */}
              <div
                className={`p-5 rounded-3xl border text-center space-y-2.5 relative overflow-hidden ${
                  internalDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-[#faf8f5] border-stone-200'
                }`}
              >
                <div className="relative inline-block mx-auto">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-3 border-emerald-600/50 shadow-md">
                    <img
                      src={selectedResident.photo}
                      alt={selectedResident.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {selectedResident.status === 'online' && (
                    <span
                      className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 w-5 h-5 bg-emerald-500 border-2.5 border-white dark:border-slate-800 rounded-full shadow-md ring-1 ring-emerald-600/40"
                      title="Online now"
                    />
                  )}
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black serif-title text-[#000000] dark:text-white">
                    {selectedResident.name}
                  </h3>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {selectedResident.apt} • {selectedResident.wing}
                  </p>
                  <p className="text-[16px] font-bold text-[#000c87] underline mt-0.5">
                    TownLoop Resident since {selectedResident.residentSince}
                  </p>
                </div>
              </div>

              {/* Phone & Address Cards (Explicitly requested by user) */}
              <div className="space-y-2.5">
                {/* Phone Card with Direct Call & Copy */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between ${
                    internalDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-[#9c9c9c] tracking-wider">
                        Phone Number
                      </p>
                      <p className="text-sm sm:text-base font-black text-[#000000] dark:text-white">
                        {selectedResident.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText?.(selectedResident.phone);
                        showToast(`Copied ${selectedResident.phone}`);
                      }}
                      className="p-2 rounded-xl bg-stone-200/80 dark:bg-slate-700 hover:bg-stone-300 text-stone-700 dark:text-slate-200 transition cursor-pointer"
                      title="Copy phone number"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => showToast(`Calling ${selectedResident.name}...`)}
                      className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition cursor-pointer shadow-xs"
                    >
                      Call
                    </button>
                  </div>
                </div>

                {/* Address Card with Copy */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                    internalDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-[#9c9c9c] tracking-wider">
                        Address / Villa
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-[#000000] dark:text-white leading-relaxed mt-0.5">
                        {selectedResident.address}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText?.(selectedResident.address);
                      showToast('Address copied to clipboard');
                    }}
                    className="p-2 rounded-xl bg-stone-200/80 dark:bg-slate-700 hover:bg-stone-300 text-stone-700 dark:text-slate-200 transition cursor-pointer shrink-0 mt-0.5"
                    title="Copy address"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* Hobbies / Interests */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border ${
                    internalDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <p className="text-xs uppercase font-bold text-stone-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Activities & Interests</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedResident.interests.map(interest => (
                      <span
                        key={interest}
                        className="px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 text-stone-700 dark:text-slate-300"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button: Send Him/Her a Message */}
              <button
                onClick={() => handleStartComposeToFriend(selectedResident)}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base transition cursor-pointer flex items-center justify-center gap-2.5 shadow-md"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Send {selectedResident.name.split(' ')[0]} a Message</span>
              </button>
            </div>
          )}

          {/* ================= VIEW 3C: COMPOSE MESSAGE ================= */}
          {activeView === 'compose' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveView('inbox')}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Cancel
                </button>
                <span className="text-sm font-black uppercase tracking-wider text-stone-700 dark:text-slate-200">
                  New Message
                </span>
                <span className="w-8" />
              </div>

              <form onSubmit={handleSendComposedMessage} className="space-y-3">
                {/* Recipient Card */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between ${
                    internalDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-[#faf8f5] border-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        composeRecipient.category === 'friend'
                          ? 'bg-emerald-100 text-emerald-800'
                          : composeRecipient.category === 'office'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {composeRecipient.category === 'friend' && <Users className="w-4 h-4" />}
                      {composeRecipient.category === 'office' && <Building2 className="w-4 h-4" />}
                      {composeRecipient.category === 'maintenance' && <Wrench className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-stone-400">Recipient</p>
                      <p className="text-sm sm:text-base font-extrabold">{composeRecipient.name}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                      composeRecipient.category === 'friend'
                        ? 'bg-emerald-100 text-emerald-800'
                        : composeRecipient.category === 'office'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {composeRecipient.category === 'friend'
                      ? 'Friend'
                      : composeRecipient.category === 'office'
                      ? 'Office'
                      : 'Maintenance'}
                  </span>
                </div>

                {/* Subject Input */}
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-stone-600 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Subject..."
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-none ${
                      internalDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-[#faf8f5] border-stone-200 text-stone-900 placeholder:text-stone-400'
                    }`}
                  />
                </div>

                {/* Message Body Input */}
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-stone-600 dark:text-slate-300 mb-1">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder={`Write your message to ${composeRecipient.name}...`}
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-none resize-none ${
                      internalDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-[#faf8f5] border-stone-200 text-stone-900 placeholder:text-stone-400'
                    }`}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Message</span>
                </button>
              </form>
            </div>
          )}

          {/* ================= VIEW 4: ACCOUNT ================= */}
          {activeView === 'account' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveView('menu')}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <span className="text-sm font-black uppercase tracking-wider text-stone-600 dark:text-slate-300">
                  Resident Account
                </span>
                <span className="text-xs text-emerald-600 font-bold">Active</span>
              </div>

              <div className="space-y-2.5 text-xs sm:text-sm">
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between ${
                    internalDarkMode
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-[#faf8f5] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Home className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Residency Address</span>
                  </div>
                  <span className="font-bold text-right break-words max-w-[220px]">{effectiveAddress}</span>
                </div>

                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between ${
                    internalDarkMode
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-[#faf8f5] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Resident Phone</span>
                  </div>
                  <span className="font-bold text-right">{effectivePhone}</span>
                </div>

                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between ${
                    internalDarkMode
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-[#faf8f5] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Emergency Contact</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{effectiveEmergency}</p>
                  </div>
                </div>

                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between ${
                    internalDarkMode
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-[#faf8f5] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Heart className="w-5 h-5 text-rose-500 shrink-0" />
                    <span>Dietary Preference</span>
                  </div>
                  <span className="font-bold text-right">{effectiveDietary}</span>
                </div>

                <div
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between ${
                    internalDarkMode
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-[#faf8f5] border-stone-200/70'
                  }`}
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Shield className="w-5 h-5 text-amber-500 shrink-0" />
                    <span>Safety Check-In</span>
                  </div>
                  <span className="font-bold text-emerald-600 text-right">Enrolled (Daily 9:00 AM)</span>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  onClick={() => showToast('Profile update request sent to front office')}
                  className="w-full py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-bold transition cursor-pointer shadow-xs"
                >
                  Request Profile Update
                </button>

                {onSwitchCommunity && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSwitchCommunity();
                    }}
                    className={`w-full py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
                      internalDarkMode
                        ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                        : 'border-stone-300 hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Switch Community</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ================= VIEW 5: LOGOUT CONFIRMATION ================= */}
          {activeView === 'logoutConfirm' && (
            <div className="space-y-4 text-center py-3">
              <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
                <LogOut className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black serif-title">
                  Log Out of Resident Portal?
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto">
                  You can easily sign back into your TownLoop account at any time.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => setActiveView('menu')}
                  className={`py-3 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                    internalDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition cursor-pointer shadow-xs"
                >
                  Yes, Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
);

  return (
    <>
      {/* Trigger Button (Profile Picture) */}
      <div className="relative inline-flex items-center justify-center">
        <button
          onClick={() => {
            setActiveView('menu');
            setIsOpen(true);
          }}
          className="group relative block rounded-full hover:ring-2 hover:ring-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-600/60 transition cursor-pointer"
          title="Open Resident Profile & Menu"
          aria-label="Open Resident Profile & Menu"
        >
          <div
            className={`relative ${
              isLarge ? 'w-16 h-16 sm:w-[70px] sm:h-[70px]' : 'w-11 h-11'
            } rounded-full overflow-hidden border-2 border-emerald-600/40 shadow-sm bg-stone-100 transition-all duration-200`}
          >
            <UserAvatar
              src={profilePhotoUrl}
              name={effectiveName}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
            <div className="absolute inset-0 bg-emerald-700/10 mix-blend-multiply" />
          </div>
        </button>

        {/* VIP & Admin Role Staff Badge: Displayed at bottom-left corner of the profile picture only */}
        {(isStrictVip(currentUser) || isAdmin(currentUser)) && (
          <div
            className="absolute -bottom-1 -left-1 sm:-bottom-1.5 sm:-left-1.5 z-10 pointer-events-none"
            title={isAdmin(currentUser) ? "Admin Staff Badge" : "VIP Staff Badge"}
          >
            <VipStaffBadge size={size} title={isAdmin(currentUser) ? "Admin Staff Badge" : "VIP Staff Badge"} />
          </div>
        )}

        {/* Crew Role Shield Badge: Displayed at bottom-left corner of the profile picture only */}
        {isCrew(currentUser) && (
          <div
            className="absolute bottom-0 left-0 -translate-x-0.5 translate-y-0.5 z-10 pointer-events-none"
            title="Maintenance Crew Badge"
          >
            <CrewShieldBadge size={size} />
          </div>
        )}

        {/* Online Status Indicator Dot */}
        <span
          className={`absolute bottom-0 right-0 translate-x-0.5 translate-y-0.5 ${
            isLarge ? 'w-5 h-5 border-[3px]' : 'w-3.5 h-3.5 border-2'
          } bg-emerald-500 border-white rounded-full shadow-md z-10 pointer-events-none ring-1 ring-emerald-600/30`}
          title="Resident online"
        />

        {/* Unread mail badge on avatar */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white font-bold text-[10px] rounded-full border-2 border-white flex items-center justify-center shadow-sm pointer-events-none"
            title={`${unreadCount} unread messages`}
          >
            {unreadCount}
          </span>
        )}
      </div>

      {/* Render via Portal so modal is always perfectly centered and within screen limits */}
      {typeof document !== 'undefined' && modalMarkup && createPortal(modalMarkup, document.body)}
    </>
  );
};
