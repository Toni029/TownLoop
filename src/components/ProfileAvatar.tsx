/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronDown,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { UserProfile, MaintenanceChat, MaintenanceChatMessage } from '../types';
import { updateResidentProfile, subscribeToCommunityDirectory } from '../services/auth';
import { canAccessAdminPanel, getUserRole, getRoleBadgeInfo, isCrew, isStrictVip, isVip, isAdmin, isStaff } from '../utils/permissions';
import { UserAvatar } from './UserAvatar';
import { CrewShieldBadge } from './CrewShieldBadge';
import { VipStaffBadge } from './VipStaffBadge';
import {
  subscribeToMaintenanceChats,
  sendMaintenanceChatMessage,
  markMaintenanceChatRead,
  deleteMaintenanceChat,
  formatMessageTime,
  getResidentChatDocId,
} from '../services/maintenanceChat';
import {
  subscribeToOfficeChats,
  sendOfficeChatMessage,
  markOfficeChatRead,
  deleteOfficeChat,
  isVipOrAdmin,
} from '../services/officeChat';
import {
  subscribeToFriendChats,
  sendFriendChatMessage,
  markFriendChatRead,
  deleteFriendChat,
  getFriendChatDocId,
  getCleanParticipantKey,
  getAllParticipantIdentifiers,
} from '../services/friendChat';
import { OfficeChat, OfficeChatMessage, ResidentChat, ResidentChatMessage } from '../types';

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
  id: number | string;
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
  maintenanceChatId?: string;
  officeChatId?: string;
  friendChatId?: string;
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
    name: 'Community Office',
    category: 'office',
    role: 'Concierge & Front Office',
    apt: 'Clubhouse Office',
    phone: '(904) 555-0100',
  });
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isFriendDropdownOpen, setIsFriendDropdownOpen] = useState(false);
  const friendDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        friendDropdownRef.current &&
        !friendDropdownRef.current.contains(e.target as Node)
      ) {
        setIsFriendDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Dynamic list of community residents (Friends & Neighbors)
  // Excludes Admin, VIP, and Crew roles as requested
  const [residents, setResidents] = useState<ResidentFriend[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToCommunityDirectory((users) => {
      if (users) {
        const mapped: ResidentFriend[] = users
          .filter(u => {
            if (!u) return false;
            // Exclude unapproved accounts
            if (u.approved === false) return false;
            // Exclude current user
            if (currentUser?.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) {
              return false;
            }
            if (currentUser?.id && u.id && String(u.id) === String(currentUser.id)) {
              return false;
            }
            // CRITICAL: When messaging a friend or neighbor, do NOT list admin, vip, or crew role
            const role = (getUserRole(u) || u.role || '').toLowerCase();
            if (role === 'admin' || role === 'vip' || role === 'crew' || role === 'staff') {
              return false;
            }
            if (isAdmin(u) || isVip(u) || isCrew(u) || isStaff(u)) {
              return false;
            }
            return true;
          })
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
  }, [currentUser?.email, currentUser?.id]);

  const userIsCrew = isCrew(currentUser);
  const userIsVip = isVipOrAdmin(currentUser);

  // Messages in Inbox: Real messages only, no fictitious or dummy data
  const [messages, setMessages] = useState<InboxMessage[]>([]);

  // Persistent track of deleted/dismissed conversation IDs
  const [deletedChatIds, setDeletedChatIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('townloop_deleted_chats_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // Clean any previous dummy messages from localStorage
    try {
      localStorage.removeItem('townloop_inbox_messages_v1');
      localStorage.removeItem('townloop_inbox_messages_v2');
      localStorage.removeItem('townloop_inbox_messages');
    } catch (e) {
      // ignore
    }
  }, []);

  // Real-time Maintenance Chats from Firestore
  const [maintenanceChats, setMaintenanceChats] = useState<MaintenanceChat[]>([]);
  const [activeMaintenanceChat, setActiveMaintenanceChat] = useState<MaintenanceChat | null>(null);
  const [chatReplyText, setChatReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMaintenanceChats(currentUser, (chats) => {
      setMaintenanceChats(chats);
      setActiveMaintenanceChat((curr) => {
        if (!curr) return null;
        const updated = chats.find((c) => c.id === curr.id);
        return updated || curr;
      });
    });
    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.role]);

  useEffect(() => {
    if (activeMaintenanceChat?.messages) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMaintenanceChat?.messages?.length]);

  // Real-time Office Chats from Firestore (Managed by VIP role users)
  const [officeChats, setOfficeChats] = useState<OfficeChat[]>([]);
  const [activeOfficeChat, setActiveOfficeChat] = useState<OfficeChat | null>(null);
  const [officeReplyText, setOfficeReplyText] = useState('');
  const [isSendingOfficeReply, setIsSendingOfficeReply] = useState(false);
  const officeChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToOfficeChats(currentUser, (chats) => {
      setOfficeChats(chats);
      setActiveOfficeChat((curr) => {
        if (!curr) return null;
        const updated = chats.find((c) => c.id === curr.id);
        return updated || curr;
      });
    });
    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.role]);

  useEffect(() => {
    if (activeOfficeChat?.messages) {
      officeChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeOfficeChat?.messages?.length]);

  // Real-time Resident / Friend Chats from Firestore
  const [friendChats, setFriendChats] = useState<ResidentChat[]>([]);
  const [activeFriendChat, setActiveFriendChat] = useState<ResidentChat | null>(null);
  const [friendReplyText, setFriendReplyText] = useState('');
  const [isSendingFriendReply, setIsSendingFriendReply] = useState(false);
  const friendChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToFriendChats(currentUser, (chats) => {
      setFriendChats(chats);
      setActiveFriendChat((curr) => {
        if (!curr) return null;
        const updated = chats.find((c) => c.id === curr.id);
        return updated || curr;
      });
    });
    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.name]);

  useEffect(() => {
    if (activeFriendChat?.messages) {
      friendChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeFriendChat?.messages?.length]);

  // Merge regular inbox messages with live maintenance chats, office chats, and resident friend chats
  const allInboxMessages: InboxMessage[] = useMemo(() => {
    const list: InboxMessage[] = [];

    // ================= RESIDENT / FRIEND CHATS (PERSISTENT FIRESTORE) =================
    const myIds = getAllParticipantIdentifiers(currentUser);
    if (friendChats.length > 0) {
      friendChats.forEach((chat) => {
        const other = chat.participants?.find(p => {
          const pIds = getAllParticipantIdentifiers(p);
          return !pIds.some(id => myIds.includes(id));
        }) || chat.participants?.[1] || chat.participants?.[0];
        const otherName = other?.name || 'Resident';
        const otherAvatar = other?.avatar || '';
        const otherPhone = other?.phone || '';
        const otherApt = other?.apt || '';
        const lastMsg = chat.messages && chat.messages.length > 0
          ? chat.messages[chat.messages.length - 1]
          : null;
        const isUnread = Boolean(
          chat.unreadBy?.some(u => myIds.includes(u.toLowerCase()))
        );

        list.push({
          id: `friend_${chat.id}`,
          from: otherName,
          senderCategory: 'friend',
          role: 'Resident',
          subject: chat.subject || 'Conversation',
          body: lastMsg ? `${lastMsg.senderName}: "${lastMsg.body}"` : (chat.lastMessage || 'Conversation'),
          time: chat.updatedAt ? formatMessageTime(chat.updatedAt) : 'Recent',
          unread: isUnread,
          senderAvatar: otherAvatar,
          senderPhone: otherPhone,
          senderApt: otherApt,
          friendChatId: chat.id,
        });
      });
    }

    // Local non-maintenance and non-office fallback
    const localFriendMsgs = messages.filter(
      m => m.senderCategory !== 'maintenance' && m.senderCategory !== 'office' &&
        !friendChats.some(fc => `friend_${fc.id}` === String(m.id) || fc.id === m.friendChatId)
    );
    list.push(...localFriendMsgs);

    // ================= MAINTENANCE CHATS =================
    const localMaint = messages.filter(m => m.senderCategory === 'maintenance');
    if (userIsCrew) {
      // Crew sees all resident threads
      if (maintenanceChats.length > 0) {
        maintenanceChats.forEach((chat) => {
          const lastMsg = chat.messages[chat.messages.length - 1];
          list.push({
            id: `maint_${chat.id}`,
            from: chat.residentName || 'Resident',
            senderCategory: 'maintenance',
            role: 'Resident',
            subject: chat.subject || 'Maintenance Service Request',
            body: lastMsg ? `${lastMsg.senderName}: "${lastMsg.body}"` : (chat.lastMessage || 'Maintenance conversation'),
            time: chat.updatedAt ? formatMessageTime(chat.updatedAt) : 'Recent',
            unread: Boolean(chat.unreadByCrew),
            senderAvatar: chat.residentAvatar,
            senderPhone: chat.residentPhone,
            senderApt: chat.residentApt,
            maintenanceChatId: chat.id,
          });
        });
      } else if (localMaint.length > 0) {
        list.push(...localMaint);
      }
    } else {
      // Resident sees their chat with Maintenance Crew
      const liveChat = maintenanceChats.length > 0 ? maintenanceChats[0] : null;
      const latestLiveMsg = liveChat?.messages && liveChat.messages.length > 0
        ? liveChat.messages[liveChat.messages.length - 1]
        : null;
      const latestLocal = localMaint.length > 0 ? localMaint[0] : null;

      if (liveChat || latestLocal) {
        const lastBody = latestLocal && (!latestLiveMsg || latestLocal.time === 'Just now')
          ? latestLocal.body
          : (latestLiveMsg ? (latestLiveMsg.senderRole === 'crew' ? `Crew: "${latestLiveMsg.body}"` : `You: "${latestLiveMsg.body}"`) : (liveChat?.lastMessage || 'Maintenance conversation'));

        list.push({
          id: liveChat ? `maint_${liveChat.id}` : (latestLocal?.id || 'maint_active'),
          from: 'Maintenance Crew',
          senderCategory: 'maintenance',
          role: 'Facilities & Repairs',
          subject: liveChat?.subject || latestLocal?.subject || 'Maintenance Service Request',
          body: lastBody,
          time: latestLocal && latestLocal.time === 'Just now' ? 'Just now' : (liveChat?.updatedAt ? formatMessageTime(liveChat.updatedAt) : 'Recent'),
          unread: Boolean(liveChat?.unreadByResident),
          senderAvatar: '/crew-badge.svg',
          senderPhone: '(904) 555-0105',
          senderApt: 'Maintenance Depot',
          maintenanceChatId: liveChat?.id,
        });
      }
    }

    // ================= OFFICE / VIP CHATS =================
    const localOffice = messages.filter(m => m.senderCategory === 'office');
    if (userIsVip) {
      // VIP role user sees all resident inquiries with the resident's identity
      if (officeChats.length > 0) {
        officeChats.forEach((chat) => {
          const lastMsg = chat.messages[chat.messages.length - 1];
          list.push({
            id: `office_${chat.id}`,
            from: chat.residentName || 'Resident',
            senderCategory: 'office',
            role: 'Resident',
            subject: chat.subject || 'Office Inquiry',
            body: lastMsg
              ? (lastMsg.senderRole === 'vip' ? `You (Office): "${lastMsg.body}"` : `${chat.residentName}: "${lastMsg.body}"`)
              : (chat.lastMessage || 'Office inquiry conversation'),
            time: chat.updatedAt ? formatMessageTime(chat.updatedAt) : 'Recent',
            unread: Boolean(chat.unreadByVip),
            senderAvatar: chat.residentAvatar,
            senderPhone: chat.residentPhone,
            senderApt: chat.residentApt,
            officeChatId: chat.id,
          });
        });
      } else if (localOffice.length > 0) {
        list.push(...localOffice);
      }
    } else {
      // Standard Resident sees their chat with Community Office
      // Resident does NOT know which VIP person is chatting or replying
      const liveOffice = officeChats.length > 0 ? officeChats[0] : null;
      const latestLiveMsg = liveOffice?.messages && liveOffice.messages.length > 0
        ? liveOffice.messages[liveOffice.messages.length - 1]
        : null;
      const latestLocalOffice = localOffice.length > 0 ? localOffice[0] : null;

      if (liveOffice || latestLocalOffice) {
        const lastBody = latestLocalOffice && (!latestLiveMsg || latestLocalOffice.time === 'Just now')
          ? latestLocalOffice.body
          : (latestLiveMsg ? (latestLiveMsg.senderRole === 'vip' ? `Office: "${latestLiveMsg.body}"` : `You: "${latestLiveMsg.body}"`) : (liveOffice?.lastMessage || 'Office inquiry'));

        list.push({
          id: liveOffice ? `office_${liveOffice.id}` : (latestLocalOffice?.id || 'office_active'),
          from: 'Community Office',
          senderCategory: 'office',
          role: 'Concierge & Front Office',
          subject: liveOffice?.subject || latestLocalOffice?.subject || 'Office Inquiry',
          body: lastBody,
          time: latestLocalOffice && latestLocalOffice.time === 'Just now' ? 'Just now' : (liveOffice?.updatedAt ? formatMessageTime(liveOffice.updatedAt) : 'Recent'),
          unread: Boolean(liveOffice?.unreadByResident),
          senderPhone: '(904) 555-0100',
          senderApt: 'Clubhouse Office',
          officeChatId: liveOffice?.id,
        });
      }
    }

    // Filter out any conversation deleted by the resident
    return list.filter((m) => {
      const idStr = String(m.id);
      const maintId = m.maintenanceChatId ? String(m.maintenanceChatId) : '';
      const offId = m.officeChatId ? String(m.officeChatId) : '';
      const frId = m.friendChatId ? String(m.friendChatId) : '';
      if (deletedChatIds.includes(idStr)) return false;
      if (maintId && deletedChatIds.includes(maintId)) return false;
      if (offId && deletedChatIds.includes(offId)) return false;
      if (frId && deletedChatIds.includes(frId)) return false;
      return true;
    });
  }, [messages, maintenanceChats, officeChats, friendChats, userIsCrew, userIsVip, currentUser, deletedChatIds]);

  const unreadCount = allInboxMessages.filter(m => m.unread).length;

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

  const markMessageAsRead = (id: number | string) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, unread: false } : m)));
  };

  const handleDeleteMessage = async (msg: InboxMessage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const idStr = String(msg.id);
    const maintId = msg.maintenanceChatId ? String(msg.maintenanceChatId) : '';
    const offId = msg.officeChatId ? String(msg.officeChatId) : '';
    const frId = msg.friendChatId ? String(msg.friendChatId) : '';

    // 1. Immediately record in persistent deleted list so it doesn't re-appear
    setDeletedChatIds(prev => {
      const next = Array.from(new Set([...prev, idStr, maintId, offId, frId].filter(Boolean)));
      try {
        localStorage.setItem('townloop_deleted_chats_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    // 2. Remove from local state
    setMessages(prev =>
      prev.filter(
        m =>
          String(m.id) !== idStr &&
          (!maintId || m.maintenanceChatId !== maintId) &&
          (!offId || m.officeChatId !== offId) &&
          (!frId || m.friendChatId !== frId)
      )
    );

    // 3. Delete from Firestore if it is a cloud conversation
    if (msg.senderCategory === 'maintenance' && (maintId || idStr.startsWith('maint_'))) {
      const targetChatId = maintId || idStr.replace(/^maint_/, '');
      await deleteMaintenanceChat(targetChatId);
    } else if (msg.senderCategory === 'office' && (offId || idStr.startsWith('office_'))) {
      const targetChatId = offId || idStr.replace(/^office_/, '');
      await deleteOfficeChat(targetChatId);
    } else if (msg.senderCategory === 'friend' && (frId || idStr.startsWith('friend_'))) {
      const targetChatId = frId || idStr.replace(/^friend_/, '');
      await deleteFriendChat(targetChatId);
    }

    // 4. Reset selected view if currently open
    if (
      selectedMessage &&
      (String(selectedMessage.id) === idStr ||
        (maintId && selectedMessage.maintenanceChatId === maintId) ||
        (offId && selectedMessage.officeChatId === offId) ||
        (frId && selectedMessage.friendChatId === frId))
    ) {
      setSelectedMessage(null);
      setActiveMaintenanceChat(null);
      setActiveOfficeChat(null);
      setActiveFriendChat(null);
    }

    showToast('Conversation deleted');
  };

  const handleOpenMessage = (msg: InboxMessage) => {
    setSelectedMessage(msg);
    if (msg.senderCategory === 'maintenance') {
      setActiveOfficeChat(null);
      if (userIsCrew) {
        const foundChat = maintenanceChats.find(
          (c) => `maint_${c.id}` === String(msg.id) || c.id === msg.maintenanceChatId
        );
        if (foundChat) {
          setActiveMaintenanceChat(foundChat);
          markMaintenanceChatRead(foundChat.id, 'crew');
        } else {
          setActiveMaintenanceChat(null);
        }
      } else {
        const foundChat = maintenanceChats[0] || null;
        if (foundChat) {
          setActiveMaintenanceChat(foundChat);
          markMaintenanceChatRead(foundChat.id, 'resident');
        } else {
          // If Firestore chat hasn't synchronized yet, create local active chat from the message
          const cleanBody = msg.body.replace(/^You: "/, '').replace(/"$/, '');
          setActiveMaintenanceChat({
            id: String(currentUser?.id || 'resident'),
            residentId: String(currentUser?.id || 'resident'),
            residentName: effectiveName,
            residentEmail: effectiveEmail,
            residentApt: effectiveAddress,
            subject: msg.subject || 'Maintenance Service Request',
            lastMessage: msg.body,
            updatedAt: Date.now(),
            unreadByCrew: false,
            unreadByResident: false,
            messages: [
              {
                id: 'msg_local_init',
                senderId: String(currentUser?.id || 'resident'),
                senderName: effectiveName,
                senderRole: 'resident',
                senderAvatar: profilePhotoUrl,
                body: cleanBody,
                createdAt: Date.now(),
                time: msg.time || 'Just now',
              },
            ],
          });
        }
      }
    } else if (msg.senderCategory === 'office') {
      setActiveMaintenanceChat(null);
      if (userIsVip) {
        const foundChat = officeChats.find(
          (c) => `office_${c.id}` === String(msg.id) || c.id === msg.officeChatId
        );
        if (foundChat) {
          setActiveOfficeChat(foundChat);
          markOfficeChatRead(foundChat.id, 'vip');
        } else {
          const cleanId = String(msg.officeChatId || msg.id).replace(/^office_/, '');
          const cleanBody = msg.body.replace(/^You \(Office\): "/, '').replace(/^(You|Office): "/, '').replace(/"$/, '');
          setActiveOfficeChat({
            id: cleanId,
            residentId: cleanId,
            residentName: msg.from.split(' (')[0] || 'Resident',
            residentEmail: '',
            residentApt: msg.senderApt || 'Resident',
            residentPhone: msg.senderPhone || '',
            residentAvatar: msg.senderAvatar || '',
            subject: msg.subject || 'Office Inquiry',
            lastMessage: msg.body,
            updatedAt: Date.now(),
            unreadByVip: false,
            unreadByResident: false,
            messages: [
              {
                id: 'msg_local_init',
                senderId: cleanId,
                senderName: msg.from.split(' (')[0] || 'Resident',
                senderRole: 'resident',
                body: cleanBody,
                createdAt: Date.now(),
                time: msg.time || 'Just now',
              },
            ],
          });
        }
      } else {
        const foundChat = officeChats[0] || null;
        if (foundChat) {
          setActiveOfficeChat(foundChat);
          markOfficeChatRead(foundChat.id, 'resident');
        } else {
          const cleanBody = msg.body.replace(/^(Office|You): "/, '').replace(/"$/, '');
          const residentDocId = getResidentChatDocId(currentUser);
          setActiveOfficeChat({
            id: residentDocId,
            residentId: String(currentUser?.id || 'resident'),
            residentName: effectiveName,
            residentEmail: effectiveEmail,
            residentApt: effectiveAddress,
            residentPhone: effectivePhone,
            residentAvatar: profilePhotoUrl,
            subject: msg.subject || 'Office Inquiry',
            lastMessage: msg.body,
            updatedAt: Date.now(),
            unreadByVip: false,
            unreadByResident: false,
            messages: [
              {
                id: 'msg_local_init',
                senderId: String(currentUser?.id || 'resident'),
                senderName: effectiveName,
                senderRole: 'resident',
                body: cleanBody,
                createdAt: Date.now(),
                time: msg.time || 'Just now',
              },
            ],
          });
        }
      }
    } else if (msg.senderCategory === 'friend') {
      setActiveMaintenanceChat(null);
      setActiveOfficeChat(null);
      const foundChat = friendChats.find(
        (c) => `friend_${c.id}` === String(msg.id) || c.id === msg.friendChatId
      );
      if (foundChat) {
        setActiveFriendChat(foundChat);
        markFriendChatRead(foundChat.id, currentUser);
      } else {
        const myKey = getCleanParticipantKey(currentUser);
        const otherKey = msg.from.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
        const fallbackChat: ResidentChat = {
          id: msg.friendChatId || getFriendChatDocId(myKey, otherKey),
          participantIds: [myKey, otherKey],
          participants: [
            { id: myKey, name: effectiveName, email: effectiveEmail, avatar: profilePhotoUrl },
            { id: otherKey, name: msg.from, phone: msg.senderPhone, apt: msg.senderApt, avatar: msg.senderAvatar }
          ],
          subject: msg.subject || 'Conversation',
          lastMessage: msg.body,
          updatedAt: Date.now(),
          unreadBy: [],
          messages: [
            {
              id: `msg_${Date.now()}`,
              senderId: otherKey,
              senderName: msg.from,
              senderRole: 'Resident',
              senderAvatar: msg.senderAvatar,
              body: msg.body.replace(/^You: "/, '').replace(/"$/, ''),
              createdAt: Date.now(),
              time: msg.time,
            }
          ]
        };
        setActiveFriendChat(fallbackChat);
      }
      if (typeof msg.id === 'number') {
        markMessageAsRead(msg.id);
      }
    } else {
      setActiveMaintenanceChat(null);
      setActiveOfficeChat(null);
      setActiveFriendChat(null);
      if (typeof msg.id === 'number') {
        markMessageAsRead(msg.id);
      }
    }
  };

  const handleStartComposeToFriend = (friend: ResidentFriend) => {
    setSelectedMessage(null);
    setActiveOfficeChat(null);
    setActiveMaintenanceChat(null);
    setActiveFriendChat(null);
    setComposeRecipient({
      name: friend.name,
      category: 'friend',
      role: `Resident (${friend.apt})`,
      apt: friend.apt,
      phone: friend.phone
    });
    setComposeSubject('');
    setComposeBody('');
    setActiveView('compose');
  };

  const handleStartComposeToFriendInitial = () => {
    if (residents.length === 0) {
      showToast('No neighbor residents available to message');
      return;
    }
    setSelectedMessage(null);
    setActiveOfficeChat(null);
    setActiveMaintenanceChat(null);
    setActiveFriendChat(null);
    setComposeRecipient({
      name: '',
      category: 'friend',
      role: 'Neighbor Resident',
      apt: '',
      phone: '',
    });
    setComposeSubject('');
    setComposeBody('');
    setActiveView('compose');
  };

  const handleStartComposeToOffice = () => {
    setSelectedMessage(null);
    setActiveOfficeChat(null);
    setActiveMaintenanceChat(null);
    setActiveFriendChat(null);
    setComposeRecipient({
      name: 'Community Office',
      category: 'office',
      role: 'Concierge & Front Office',
      apt: 'Clubhouse Office',
      phone: '(904) 555-0100'
    });
    setComposeSubject('');
    setComposeBody('');
    setActiveView('compose');
  };

  const handleStartComposeToMaintenance = () => {
    setSelectedMessage(null);
    setActiveOfficeChat(null);
    setActiveMaintenanceChat(null);
    setActiveFriendChat(null);
    setComposeRecipient({
      name: 'Maintenance Crew',
      category: 'maintenance',
      role: 'Facilities & Repairs',
      apt: 'Maintenance Depot',
      phone: '(904) 555-0105'
    });
    setComposeSubject('');
    setComposeBody('');
    setActiveView('compose');
  };

  const handleSendComposedMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (composeRecipient.category === 'friend' && !composeRecipient.name.trim()) {
      showToast('Please select a neighbor / friend to send your message to');
      return;
    }
    if (!composeBody.trim()) {
      showToast('Please type a message before sending');
      return;
    }

    if (composeRecipient.category === 'maintenance') {
      const messageBody = composeBody.trim();
      const messageSubject = composeSubject.trim() || 'Maintenance Service Request';

      // 1. Prepare resident target for Firestore sync
      const residentTarget = userIsCrew && activeMaintenanceChat
        ? {
            id: activeMaintenanceChat.residentId,
            name: activeMaintenanceChat.residentName,
            email: activeMaintenanceChat.residentEmail,
            unit: activeMaintenanceChat.residentApt,
            address: activeMaintenanceChat.residentApt,
            phone: activeMaintenanceChat.residentPhone,
            avatar: activeMaintenanceChat.residentAvatar,
          }
        : {
            id: currentUser?.id ? String(currentUser.id) : (currentUser?.email ? currentUser.email : 'resident'),
            name: effectiveName,
            email: effectiveEmail,
            unit: effectiveAddress,
            address: effectiveAddress,
            phone: effectivePhone,
            avatar: profilePhotoUrl,
          };

      const docId = getResidentChatDocId(residentTarget);

      // 2. Immediately create and add to local state messages so it appears instantly in ALL and CREW!
      const newMaintMsg: InboxMessage = {
        id: `maint_${docId}`,
        from: 'Maintenance Crew',
        senderCategory: 'maintenance',
        role: 'Facilities & Repairs',
        subject: messageSubject,
        body: `You: "${messageBody}"`,
        time: 'Just now',
        unread: false,
        senderAvatar: '/crew-badge.svg',
        senderPhone: '(904) 555-0105',
        senderApt: 'Maintenance Depot',
        maintenanceChatId: docId,
      };

      setMessages(prev => [newMaintMsg, ...prev.filter(m => m.maintenanceChatId !== docId && m.id !== `maint_${docId}`)]);

      // 3. Persist to Firestore maintenance_chats
      sendMaintenanceChatMessage({
        resident: residentTarget,
        sender: currentUser || { id: 'resident', name: effectiveName, role: 'resident' },
        body: messageBody,
        subject: messageSubject,
      }).catch(err => console.warn('Maintenance chat sync warning:', err));

      showToast(userIsCrew ? 'Reply sent to resident!' : 'Message sent to Maintenance Crew!');
      setComposeBody('');
      setComposeSubject('');
      setActiveView('inbox');
      setInboxFilter('all');
      return;
    }

    if (composeRecipient.category === 'office') {
      const messageBody = composeBody.trim();
      const messageSubject = composeSubject.trim() || 'Office Inquiry';

      // 1. Prepare resident target for Firestore sync
      const residentTarget = userIsVip && activeOfficeChat
        ? {
            id: activeOfficeChat.residentId,
            name: activeOfficeChat.residentName,
            email: activeOfficeChat.residentEmail,
            unit: activeOfficeChat.residentApt,
            address: activeOfficeChat.residentApt,
            phone: activeOfficeChat.residentPhone,
            avatar: activeOfficeChat.residentAvatar,
          }
        : {
            id: currentUser?.id ? String(currentUser.id) : (currentUser?.email ? currentUser.email : 'resident'),
            name: effectiveName,
            email: effectiveEmail,
            unit: effectiveAddress,
            address: effectiveAddress,
            phone: effectivePhone,
            avatar: profilePhotoUrl,
          };

      const docId = getResidentChatDocId(residentTarget);

      const newOfficeMsg: InboxMessage = {
        id: `office_${docId}`,
        from: userIsVip && activeOfficeChat ? (activeOfficeChat.residentName || 'Resident') : 'Community Office',
        senderCategory: 'office',
        role: userIsVip && activeOfficeChat ? 'Resident' : 'Concierge & Front Office',
        subject: messageSubject,
        body: `You: "${messageBody}"`,
        time: 'Just now',
        unread: false,
        senderPhone: '(904) 555-0100',
        senderApt: 'Clubhouse Office',
        officeChatId: docId,
      };

      setMessages(prev => [newOfficeMsg, ...prev.filter(m => m.officeChatId !== docId && m.id !== `office_${docId}`)]);

      sendOfficeChatMessage({
        resident: residentTarget,
        sender: currentUser || { id: 'resident', name: effectiveName, role: userIsVip ? 'vip' : 'resident' },
        body: messageBody,
        subject: messageSubject,
      }).catch(err => console.warn('Office chat sync warning:', err));

      showToast(userIsVip ? 'Reply sent to resident!' : 'Message sent to Community Office!');
      setComposeBody('');
      setComposeSubject('');
      setActiveView('inbox');
      setInboxFilter('all');
      return;
    }

    // Regular non-maintenance, non-office message (Friend) - PERSISTENT TO FIRESTORE
    const messageBody = composeBody.trim();
    const messageSubject = composeSubject.trim() || 'Conversation';

    const updatedChat = await sendFriendChatMessage({
      sender: currentUser || { id: 'resident', name: effectiveName, role: 'resident', avatar_url: profilePhotoUrl, phone: effectivePhone, address: effectiveAddress },
      recipient: {
        id: composeRecipient.name.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_'),
        name: composeRecipient.name,
        email: '',
        avatar: '',
        phone: composeRecipient.phone || '',
        apt: composeRecipient.apt || '',
      },
      body: messageBody,
      subject: messageSubject,
    });

    // Ensure the chat is removed from deletedChatIds
    setDeletedChatIds(prev => {
      const filtered = prev.filter(d => d !== updatedChat.id && d !== `friend_${updatedChat.id}`);
      try {
        localStorage.setItem('townloop_deleted_chats_v1', JSON.stringify(filtered));
      } catch {}
      return filtered;
    });

    // 1. Immediately update friendChats state so the Inbox displays it instantly
    setFriendChats(prev => [updatedChat, ...prev.filter(c => c.id !== updatedChat.id)]);

    // 2. Immediately add to messages list for guaranteed immediate rendering
    const newFriendInboxMsg: InboxMessage = {
      id: `friend_${updatedChat.id}`,
      from: composeRecipient.name,
      senderCategory: 'friend',
      role: 'Resident',
      subject: messageSubject,
      body: `You: "${messageBody}"`,
      time: 'Just now',
      unread: false,
      senderPhone: composeRecipient.phone,
      senderApt: composeRecipient.apt,
      friendChatId: updatedChat.id,
    };
    setMessages(prev => [newFriendInboxMsg, ...prev.filter(m => m.friendChatId !== updatedChat.id && m.id !== `friend_${updatedChat.id}`)]);

    showToast(`Message sent to ${composeRecipient.name}!`);
    setComposeBody('');
    setComposeSubject('');
    setActiveView('inbox');
    setInboxFilter('all');
  };

  const handleSendInlineFriendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendReplyText.trim() || isSendingFriendReply) return;

    const replyContent = friendReplyText.trim();
    setIsSendingFriendReply(true);
    setFriendReplyText('');

    const myKey = getCleanParticipantKey(currentUser);
    const other = activeFriendChat?.participants?.find(p => p.id !== myKey) || {
      id: selectedMessage ? selectedMessage.from.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : 'recipient',
      name: selectedMessage ? selectedMessage.from : 'Resident',
      phone: selectedMessage?.senderPhone,
      apt: selectedMessage?.senderApt,
      avatar: selectedMessage?.senderAvatar,
    };

    // Optimistically update activeFriendChat
    const optMsg: ResidentChatMessage = {
      id: `msg_opt_${Date.now()}`,
      senderId: myKey,
      senderName: effectiveName,
      senderRole: 'Resident',
      senderAvatar: profilePhotoUrl,
      body: replyContent,
      createdAt: Date.now(),
      time: 'Just now',
    };

    if (activeFriendChat) {
      setActiveFriendChat(curr => curr ? {
        ...curr,
        messages: [...(curr.messages || []), optMsg],
        lastMessage: `You: ${replyContent}`,
        updatedAt: Date.now(),
      } : null);
    }

    try {
      const updatedChat = await sendFriendChatMessage({
      sender: currentUser || { id: 'resident', name: effectiveName, role: 'resident', avatar_url: profilePhotoUrl, phone: effectivePhone, address: effectiveAddress },
      recipient: {
        id: other.id,
        name: other.name,
        email: other.email,
        avatar: other.avatar,
        phone: other.phone,
        apt: other.apt,
      },
      body: replyContent,
      subject: activeFriendChat?.subject || selectedMessage?.subject || 'Conversation',
    });

    // Ensure the chat is removed from deletedChatIds
    setDeletedChatIds(prev => {
      const filtered = prev.filter(d => d !== updatedChat.id && d !== `friend_${updatedChat.id}`);
      try {
        localStorage.setItem('townloop_deleted_chats_v1', JSON.stringify(filtered));
      } catch {}
      return filtered;
    });

    // Update friendChats & activeFriendChat
    setFriendChats(prev => [updatedChat, ...prev.filter(c => c.id !== updatedChat.id)]);
    setActiveFriendChat(updatedChat);

    // Update inbox message
    const updatedInboxMsg: InboxMessage = {
      id: `friend_${updatedChat.id}`,
      from: selectedMessage?.from || other.name || 'Resident',
      senderCategory: 'friend',
      role: 'Resident',
      subject: updatedChat.subject || 'Conversation',
      body: `You: "${replyContent}"`,
      time: 'Just now',
      unread: false,
      senderPhone: selectedMessage?.senderPhone || other.phone,
      senderApt: selectedMessage?.senderApt || other.apt,
      senderAvatar: selectedMessage?.senderAvatar || other.avatar,
      friendChatId: updatedChat.id,
    };
    setMessages(prev => [updatedInboxMsg, ...prev.filter(m => m.friendChatId !== updatedChat.id && m.id !== `friend_${updatedChat.id}`)]);

    showToast('Reply sent!');
  } catch (err) {
    console.error('Failed to send friend reply:', err);
    showToast('Failed to send message.');
  } finally {
    setIsSendingFriendReply(false);
  }
  };

  const handleSendInlineMaintenanceReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatReplyText.trim() || isSendingReply) return;

    const replyContent = chatReplyText.trim();
    setIsSendingReply(true);
    setChatReplyText('');

    // Optimistically append message to activeMaintenanceChat so it shows immediately!
    const optimisticMessage: MaintenanceChatMessage = {
      id: `msg_opt_${Date.now()}`,
      senderId: String(currentUser?.id || currentUser?.email || 'me'),
      senderName: currentUser?.name || (userIsCrew ? 'Maintenance Crew' : 'Resident'),
      senderRole: userIsCrew ? 'crew' : 'resident',
      senderAvatar: profilePhotoUrl,
      body: replyContent,
      createdAt: Date.now(),
      time: 'Just now',
    };

    setActiveMaintenanceChat(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticMessage],
        lastMessage: userIsCrew ? `${currentUser?.name || 'Crew'}: ${replyContent}` : replyContent,
        updatedAt: Date.now(),
      };
    });

    try {
      const residentTarget = userIsCrew && activeMaintenanceChat
        ? {
            id: activeMaintenanceChat.residentId,
            name: activeMaintenanceChat.residentName,
            email: activeMaintenanceChat.residentEmail,
            unit: activeMaintenanceChat.residentApt,
            address: activeMaintenanceChat.residentApt,
            phone: activeMaintenanceChat.residentPhone,
            avatar: activeMaintenanceChat.residentAvatar,
          }
        : {
            id: currentUser?.id ? String(currentUser.id) : (currentUser?.email ? currentUser.email : 'resident'),
            name: effectiveName,
            email: effectiveEmail,
            unit: effectiveAddress,
            address: effectiveAddress,
            phone: effectivePhone,
            avatar: profilePhotoUrl,
          };

      const docId = getResidentChatDocId(residentTarget);

      const updatedMaintMsg: InboxMessage = {
        id: `maint_${docId}`,
        from: userIsCrew && activeMaintenanceChat ? (activeMaintenanceChat.residentName || 'Resident') : 'Maintenance Crew',
        senderCategory: 'maintenance',
        role: userIsCrew && activeMaintenanceChat ? 'Resident' : 'Facilities & Repairs',
        subject: activeMaintenanceChat?.subject || 'Maintenance Service Request',
        body: userIsCrew ? `${currentUser?.name || 'Crew'}: "${replyContent}"` : `You: "${replyContent}"`,
        time: 'Just now',
        unread: false,
        senderAvatar: userIsCrew && activeMaintenanceChat ? activeMaintenanceChat.residentAvatar : '/crew-badge.svg',
        senderPhone: userIsCrew && activeMaintenanceChat ? activeMaintenanceChat.residentPhone : '(904) 555-0105',
        senderApt: userIsCrew && activeMaintenanceChat ? activeMaintenanceChat.residentApt : 'Maintenance Depot',
        maintenanceChatId: docId,
      };

      setMessages(prev => [updatedMaintMsg, ...prev.filter(m => m.maintenanceChatId !== docId && m.id !== `maint_${docId}`)]);

      await sendMaintenanceChatMessage({
        resident: residentTarget,
        sender: currentUser || { id: 'resident', name: effectiveName, role: userIsCrew ? 'crew' : 'resident' },
        body: replyContent,
        subject: activeMaintenanceChat?.subject || 'Maintenance Service Request',
      });

      showToast(userIsCrew ? 'Reply sent to resident!' : 'Message sent to Maintenance Crew!');
    } catch (err) {
      console.error('Failed to send maintenance reply:', err);
      showToast('Failed to send message.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSendInlineOfficeReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeReplyText.trim() || isSendingOfficeReply) return;

    const replyContent = officeReplyText.trim();
    setIsSendingOfficeReply(true);
    setOfficeReplyText('');

    const optimisticMessage: OfficeChatMessage = {
      id: `msg_opt_${Date.now()}`,
      senderId: String(currentUser?.id || currentUser?.email || 'me'),
      senderName: userIsVip ? 'Community Office' : (currentUser?.name || 'Resident'),
      senderRole: userIsVip ? 'vip' : 'resident',
      body: replyContent,
      createdAt: Date.now(),
      time: 'Just now',
    };

    setActiveOfficeChat(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticMessage],
        lastMessage: replyContent,
        updatedAt: Date.now(),
      };
    });

    try {
      const residentTarget = userIsVip && activeOfficeChat
        ? {
            id: activeOfficeChat.residentId,
            name: activeOfficeChat.residentName,
            email: activeOfficeChat.residentEmail,
            unit: activeOfficeChat.residentApt,
            address: activeOfficeChat.residentApt,
            phone: activeOfficeChat.residentPhone,
            avatar: activeOfficeChat.residentAvatar,
          }
        : {
            id: currentUser?.id ? String(currentUser.id) : (currentUser?.email ? currentUser.email : 'resident'),
            name: effectiveName,
            email: effectiveEmail,
            unit: effectiveAddress,
            address: effectiveAddress,
            phone: effectivePhone,
            avatar: profilePhotoUrl,
          };

      const docId = getResidentChatDocId(residentTarget);

      const updatedOfficeMsg: InboxMessage = {
        id: `office_${docId}`,
        from: userIsVip && activeOfficeChat ? (activeOfficeChat.residentName || 'Resident') : 'Community Office',
        senderCategory: 'office',
        role: userIsVip && activeOfficeChat ? 'Resident' : 'Concierge & Front Office',
        subject: activeOfficeChat?.subject || 'Office Inquiry',
        body: userIsVip ? `You (Office): "${replyContent}"` : `You: "${replyContent}"`,
        time: 'Just now',
        unread: false,
        senderPhone: userIsVip && activeOfficeChat ? activeOfficeChat.residentPhone : '(904) 555-0100',
        senderApt: userIsVip && activeOfficeChat ? activeOfficeChat.residentApt : 'Clubhouse Office',
        officeChatId: docId,
      };

      setMessages(prev => [updatedOfficeMsg, ...prev.filter(m => m.officeChatId !== docId && m.id !== `office_${docId}`)]);

      await sendOfficeChatMessage({
        resident: residentTarget,
        sender: currentUser || { id: 'resident', name: effectiveName, role: userIsVip ? 'vip' : 'resident' },
        body: replyContent,
        subject: activeOfficeChat?.subject || 'Office Inquiry',
      });

      showToast(userIsVip ? 'Reply sent to resident!' : 'Message sent to Community Office!');
    } catch (err) {
      console.error('Failed to send office reply:', err);
      showToast('Failed to send message.');
    } finally {
      setIsSendingOfficeReply(false);
    }
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

  // Filtered Messages: ALWAYS based on allInboxMessages so live chats and updates appear properly in ALL and CREW!
  const filteredMessages = allInboxMessages.filter(msg => {
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
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 bg-stone-950/45 backdrop-blur-xl z-[100] flex items-center justify-center p-3 sm:p-5"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <motion.div
            key="profile-avatar-window"
            initial={{ opacity: 0, scale: 0.84, y: -28, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              scale: 0.88,
              y: -18,
              filter: 'blur(8px)',
              transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
            }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 280,
              mass: 0.75,
            }}
            className={`liquid-glass-modal w-full max-w-[500px] sm:max-w-[540px] h-[520px] sm:h-[560px] rounded-[32px] sm:rounded-[36px] p-4 sm:p-5 pt-3.5 sm:pt-4 shadow-2xl relative flex flex-col overflow-hidden antialiased [text-rendering:optimizeLegibility] ${
              internalDarkMode
                ? 'text-white'
                : 'text-stone-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Liquid Glass Dynamic Specular Light Flare Sweep (iOS 26 Liquid Glass) */}
            <motion.div
              initial={{ x: '-100%', opacity: 0.8 }}
              animate={{ x: '180%', opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="absolute inset-0 -skew-x-12 pointer-events-none z-10 bg-gradient-to-r from-transparent via-white/25 dark:via-white/12 to-transparent w-full h-full"
            />
        {/* Close Button on the very top right */}
        <button
          onClick={() => setIsOpen(false)}
          className={`liquid-glass-subpanel liquid-glass-subpanel-interactive !absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition cursor-pointer z-50 ${
            internalDarkMode
              ? 'text-slate-200 hover:text-white'
              : 'text-stone-700 hover:text-stone-900'
          }`}
          aria-label="Close Resident Menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Toast Notification inside modal */}
        {toastMessage && (
          <div className="absolute top-3.5 left-4 right-16 bg-emerald-600 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-md text-center animate-in fade-in slide-in-from-top-2 duration-200 z-30">
            {toastMessage}
          </div>
        )}

        {/* Inner Container */}
        <div className={`flex-1 min-h-0 w-full flex flex-col ${activeView === 'inbox' && !selectedMessage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden hide-scrollbar native-scroll overscroll-contain touch-pan-y space-y-3.5'}`}>
          {/* ================= VIEW 1: MAIN MENU ================= */}
          {activeView === 'menu' && (
            <div className="space-y-3.5">
              {/* Profile Header Card brought right up to top */}
              <div className="flex items-center gap-3.5 pt-0 pr-11 sm:pr-12">
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
                    const hasSpecialRole = isAdmin(currentUser) || isVip(currentUser) || isStaff(currentUser);
                    const hasCrewRole = isCrew(currentUser) || role === 'crew';
                    return (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badge.bg}`}
                        >
                          {hasSpecialRole && (
                            <img
                              src="/vip-badge.svg"
                              alt="VIP Badge"
                              className="w-3.5 h-3.5 object-contain inline-block"
                            />
                          )}
                          {hasCrewRole && (
                            <img
                              src="/crew-badge.svg"
                              alt="Crew Badge"
                              className="w-5 h-5 object-contain inline-block"
                            />
                          )}
                          <span>{badge.label}</span>
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
                  className="liquid-glass-subpanel liquid-glass-subpanel-interactive w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 shadow-xs">
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
                  className="liquid-glass-subpanel liquid-glass-subpanel-interactive w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
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
                  className="liquid-glass-subpanel liquid-glass-subpanel-interactive w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-100/80 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
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
                <div className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl">
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
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/5 dark:bg-black/30 border border-white/20 dark:border-white/10">
                    <button
                      onClick={() => handleToggleTheme(false)}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                        !internalDarkMode
                          ? 'liquid-glass-subpanel text-stone-900 shadow-xs font-extrabold'
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
                          ? 'liquid-glass-subpanel text-white shadow-xs font-extrabold'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                {/* 5. LOG OUT */}
                <button
                  type="button"
                  onClick={() => setActiveView('logoutConfirm')}
                  className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white transition cursor-pointer text-left shadow-md border border-rose-500/40"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-700/60 text-white flex items-center justify-center shrink-0 shadow-xs border border-rose-500/50">
                      <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-extrabold text-white leading-snug">Log Out</p>
                      <p className="text-xs sm:text-[13px] text-rose-100/90 font-medium">
                        Sign out of TownLoop portal
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-rose-200 shrink-0" />
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
            <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
              {/* TOP BAR: Stay Put */}
              <div className="shrink-0 flex items-center justify-between pb-2 border-b border-stone-200 dark:border-slate-800 pr-11 sm:pr-12 gap-2">
                <button
                  onClick={() => setActiveView('menu')}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-800 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 transition cursor-pointer py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <div className="text-center min-w-0">
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

              {/* CATEGORIES (ALL, FRIENDS, OFFICE, CREW): Stay Put */}
              <div className="shrink-0 py-2.5">
                <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl liquid-glass-subpanel text-xs font-bold shadow-xs w-full max-w-full">
                  <button
                    onClick={() => setInboxFilter('all')}
                    className={`py-1.5 px-1 rounded-xl transition text-center cursor-pointer truncate text-[11px] sm:text-xs ${
                      inboxFilter === 'all'
                        ? 'liquid-glass-subpanel text-stone-900 dark:text-white shadow-xs font-extrabold'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setInboxFilter('friend')}
                    className={`py-1.5 px-1 rounded-xl transition text-center cursor-pointer truncate text-[11px] sm:text-xs ${
                      inboxFilter === 'friend'
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    Friends
                  </button>
                  <button
                    onClick={() => setInboxFilter('office')}
                    className={`py-1.5 px-1 rounded-xl transition text-center cursor-pointer truncate text-[11px] sm:text-xs ${
                      inboxFilter === 'office'
                        ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    Office
                  </button>
                  <button
                    onClick={() => setInboxFilter('maintenance')}
                    className={`py-1.5 px-1 rounded-xl transition text-center cursor-pointer truncate text-[11px] sm:text-xs ${
                      inboxFilter === 'maintenance'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    Crew
                  </button>
                </div>
              </div>

              {/* IN THE MIDDLE: ALL THE CHATS SCROLL */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar native-scroll overscroll-contain touch-pan-y space-y-2.5 pr-0.5 pb-2">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 dark:text-slate-500 space-y-2">
                    <Mail className="w-10 h-10 mx-auto opacity-40" />
                    <p className="text-sm font-medium">No messages in this folder.</p>
                  </div>
                ) : (
                  filteredMessages.map(msg => {
                    const isOffice = msg.senderCategory === 'office';
                    const isCrew = msg.senderCategory === 'maintenance';
                    const isFriend = msg.senderCategory === 'friend';

                    const senderDisplayName = msg.from.replace(/\s*\([^)]*\)/g, '').trim();
                    const displayRole = isFriend
                      ? 'Resident'
                      : isOffice
                      ? (userIsVip ? 'Resident' : 'Community Office')
                      : (userIsCrew ? 'Resident' : 'Maintenance Crew');

                    // Color coded themes:
                    // Friends: Emerald
                    // Office: Blue
                    // Crew: Amber
                    const cardTheme = isOffice
                      ? msg.unread
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-[5px] border-l-blue-600 border-blue-200 dark:border-blue-800 shadow-2xs'
                        : 'bg-blue-50/35 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/35 border-l-[5px] border-l-blue-500/80 border-blue-200/60 dark:border-blue-900/40'
                      : isCrew
                      ? msg.unread
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-l-[5px] border-l-amber-600 border-amber-200 dark:border-amber-800 shadow-2xs'
                        : 'bg-amber-50/35 hover:bg-amber-50/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/35 border-l-[5px] border-l-amber-500/80 border-amber-200/60 dark:border-amber-900/40'
                      : msg.unread
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-l-[5px] border-l-emerald-600 border-emerald-200 dark:border-emerald-800 shadow-2xs'
                      : 'bg-emerald-50/35 hover:bg-emerald-50/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35 border-l-[5px] border-l-emerald-500/80 border-emerald-200/60 dark:border-emerald-900/40';

                    const badgeTheme = isOffice
                      ? 'bg-blue-100 text-blue-800 border-blue-200/80 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800'
                      : isCrew
                      ? 'bg-amber-100 text-amber-800 border-amber-200/80 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800';

                    const iconTheme = isOffice
                      ? 'bg-blue-100/90 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800'
                      : isCrew
                      ? 'bg-amber-100/90 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-emerald-100/90 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800';

                    const dotColor = isOffice
                      ? 'bg-blue-600 dark:bg-blue-400'
                      : isCrew
                      ? 'bg-amber-600 dark:bg-amber-400'
                      : 'bg-emerald-600 dark:bg-emerald-400';

                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleOpenMessage(msg)}
                        className={`w-full max-w-full p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer text-left group overflow-hidden ${cardTheme}`}
                      >
                        {/* Top row: Category Icon + Sender info + Timestamp + Trash Button */}
                        <div className="flex items-center justify-between gap-2 w-full min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Sender Category Tag / Icon */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${iconTheme}`}>
                              {isFriend && <Users className="w-4 h-4" />}
                              {isOffice && <Building2 className="w-4 h-4" />}
                              {isCrew && (
                                <img src="/crew-badge.svg" alt="Crew" className="w-4 h-4 object-contain inline-block" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-xs sm:text-sm font-black leading-tight text-stone-900 dark:text-white truncate">
                                  {senderDisplayName}
                                </p>
                                <span
                                  className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border shrink-0 ${badgeTheme}`}
                                >
                                  {isFriend ? 'Friend' : isOffice ? 'Office' : 'Crew'}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate leading-none mt-0.5">
                                {displayRole}
                              </p>
                            </div>
                          </div>

                          {/* Right side: Timestamp + Unread dot + Trashcan action */}
                          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
                            {msg.unread && (
                              <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0 ring-2 ring-white dark:ring-stone-900`} />
                            )}
                            <span className="text-[11px] sm:text-xs text-stone-400 dark:text-slate-400 font-medium shrink-0 whitespace-nowrap">
                              {msg.time}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteMessage(msg, e)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-100/70 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 transition cursor-pointer shrink-0 ml-0.5"
                              title="Delete conversation"
                              aria-label="Delete conversation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Subject */}
                        <h4 className="text-xs sm:text-sm font-bold mt-2 text-stone-900 dark:text-white leading-snug truncate group-hover:underline">
                          {msg.subject}
                        </h4>

                        {/* Body snippet */}
                        <p className="text-[11px] sm:text-xs text-stone-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                          {msg.body}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* BOTTOM BUTTONS: Stay Put */}
              <div className="shrink-0 pt-2 pb-0.5 border-t border-stone-200/60 dark:border-slate-800/60 flex gap-1.5 sm:gap-2 w-full max-w-full">
                <button
                  type="button"
                  onClick={handleStartComposeToOffice}
                  className="flex-1 py-2 px-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 transition cursor-pointer flex items-center justify-center gap-1 truncate"
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Msg Office</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartComposeToMaintenance}
                  className="flex-1 py-2 px-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800 transition cursor-pointer flex items-center justify-center gap-1 truncate"
                >
                  <img src="/crew-badge.svg" alt="Crew" className="w-3.5 h-3.5 object-contain inline-block shrink-0" />
                  <span className="truncate">Msg Crew</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartComposeToFriendInitial}
                  className="flex-1 py-2 px-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center justify-center gap-1 truncate"
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Msg Friend</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= VIEW 2B: MAINTENANCE GROUP CHAT VIEW ================= */}
          {activeView === 'inbox' && selectedMessage && selectedMessage.senderCategory === 'maintenance' && (
            <div className="space-y-3 flex flex-col h-[520px] sm:h-[580px]">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 pr-11 sm:pr-12 shrink-0 gap-2">
                <button
                  onClick={() => {
                    setSelectedMessage(null);
                    setActiveMaintenanceChat(null);
                  }}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>All Messages</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800">
                    <img src="/crew-badge.svg" alt="Crew" className="w-3.5 h-3.5 object-contain inline-block" />
                    <span>Maintenance Team</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMessage(selectedMessage, e)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition cursor-pointer shrink-0"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat Subject / Info Banner */}
              <div
                className="liquid-glass-subpanel p-3 rounded-2xl flex items-center justify-between shrink-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 flex items-center justify-center shrink-0 shadow-xs">
                    <img src="/crew-badge.svg" alt="Crew" className="w-5 h-5 object-contain inline-block" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold truncate">
                      {userIsCrew && activeMaintenanceChat
                        ? (activeMaintenanceChat.residentName || 'Resident')
                        : 'Maintenance Crew'}
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                      {userIsCrew && activeMaintenanceChat
                        ? (activeMaintenanceChat.residentPhone ? `Tel: ${activeMaintenanceChat.residentPhone}` : 'Direct Resident Inquiry')
                        : 'Facilities & Repairs • (904) 555-0105'}
                    </p>
                  </div>
                </div>
                {userIsCrew && activeMaintenanceChat && activeMaintenanceChat.residentPhone && (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText?.(activeMaintenanceChat.residentPhone || '');
                      showToast(`Copied ${activeMaintenanceChat.residentPhone}`);
                    }}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                  >
                    Copy Phone
                  </button>
                )}
              </div>

              {/* Conversation Messages Thread */}
              <div className="flex-1 overflow-y-auto hide-scrollbar native-scroll space-y-3 p-2.5 rounded-2xl liquid-glass-subpanel pr-2 overscroll-contain touch-pan-y">
                {activeMaintenanceChat && activeMaintenanceChat.messages && activeMaintenanceChat.messages.length > 0 ? (
                  activeMaintenanceChat.messages.map((m) => {
                    if (userIsCrew) {
                      // CREW PERSPECTIVE:
                      // Crew sees each crew member distinctly and the resident!
                      const isFromMe = m.senderId === String(currentUser?.id || currentUser?.email);
                      const isFromOtherCrew = m.senderRole === 'crew' && !isFromMe;
                      const isFromResident = m.senderRole !== 'crew';

                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            {m.senderRole === 'crew' && (
                              <img
                                src="/crew-badge.svg"
                                alt="Crew"
                                className="w-3.5 h-3.5 object-contain inline-block"
                              />
                            )}
                            <span className="text-[11px] font-bold text-stone-600 dark:text-slate-300">
                              {isFromMe
                                ? `You (${currentUser?.name || 'Crew'})`
                                : isFromOtherCrew
                                ? `${m.senderName} (Crew)`
                                : `${activeMaintenanceChat.residentName} (Resident)`}
                            </span>
                            <span className="text-[10px] text-stone-400">{m.time}</span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                              isFromMe
                                ? 'bg-blue-600 text-white rounded-br-xs'
                                : isFromOtherCrew
                                ? 'bg-indigo-100 text-indigo-950 dark:bg-indigo-950/80 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 rounded-bl-xs'
                                : 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-bl-xs'
                            }`}
                          >
                            {m.body}
                          </div>
                        </div>
                      );
                    } else {
                      // RESIDENT PERSPECTIVE:
                      // Resident sees one single chat with Maintenance Crew!
                      const isFromResident = m.senderRole !== 'crew';

                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isFromResident ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            {!isFromResident && (
                              <img
                                src="/crew-badge.svg"
                                alt="Crew"
                                className="w-3.5 h-3.5 object-contain inline-block"
                              />
                            )}
                            <span className="text-[11px] font-bold text-stone-600 dark:text-slate-300">
                              {isFromResident ? 'You' : 'Maintenance Crew'}
                            </span>
                            <span className="text-[10px] text-stone-400">{m.time}</span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                              isFromResident
                                ? 'bg-emerald-600 text-white rounded-br-xs'
                                : 'bg-[#edf5ee] text-[#124d2c] dark:bg-slate-800 dark:text-emerald-300 border border-[#bcdbc6] dark:border-slate-700 rounded-bl-xs'
                            }`}
                          >
                            {m.body}
                          </div>
                        </div>
                      );
                    }
                  })
                ) : (
                  <div className="text-center py-10 text-stone-400 dark:text-slate-500 space-y-2">
                    <img src="/crew-badge.svg" alt="Crew" className="w-10 h-10 object-contain mx-auto opacity-70" />
                    <p className="text-xs sm:text-sm font-semibold">
                      {userIsCrew ? 'No previous messages in this thread.' : 'Send a message to our Maintenance Crew.'}
                    </p>
                    <p className="text-[11px] text-stone-400 max-w-xs mx-auto">
                      {userIsCrew
                        ? 'Any reply you send will be visible to all crew members and the resident.'
                        : 'All on-duty crew members will receive your message and can reply directly here.'}
                    </p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Inline Reply Input */}
              <form onSubmit={handleSendInlineMaintenanceReply} className="flex gap-2 items-center pt-1 shrink-0">
                <input
                  type="text"
                  value={chatReplyText}
                  onChange={(e) => setChatReplyText(e.target.value)}
                  placeholder={
                    userIsCrew
                      ? `Reply as ${currentUser?.name || 'Crew'} (Maintenance Crew)...`
                      : 'Type a message to Maintenance Crew...'
                  }
                  className="flex-1 py-2.5 px-3.5 rounded-xl liquid-glass-input text-xs sm:text-sm focus:outline-none"
                  disabled={isSendingReply}
                />
                <button
                  type="submit"
                  disabled={!chatReplyText.trim() || isSendingReply}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          )}

          {/* ================= VIEW 2C: COMMUNITY OFFICE CHAT VIEW (INTERACTIVE) ================= */}
          {activeView === 'inbox' && selectedMessage && selectedMessage.senderCategory === 'office' && (
            <div className="space-y-3 flex flex-col h-[520px] sm:h-[580px]">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 pr-11 sm:pr-12 shrink-0 gap-2">
                <button
                  onClick={() => {
                    setSelectedMessage(null);
                    setActiveOfficeChat(null);
                  }}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>All Messages</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800">
                    <Building2 className="w-3.5 h-3.5 inline-block" />
                    <span>{userIsVip ? 'Resident Office Inquiry' : 'Community Office'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMessage(selectedMessage, e)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition cursor-pointer shrink-0"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat Subject / Info Banner */}
              <div
                className="liquid-glass-subpanel p-3 rounded-2xl flex items-center justify-between shrink-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    {userIsVip && activeOfficeChat?.residentAvatar ? (
                      <UserAvatar
                        src={activeOfficeChat.residentAvatar}
                        name={activeOfficeChat.residentName}
                        size="sm"
                        className="w-full h-full rounded-xl"
                      />
                    ) : (
                      <Building2 className="w-5 h-5 text-blue-800 dark:text-blue-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold truncate">
                      {userIsVip && activeOfficeChat
                        ? (activeOfficeChat.residentName || 'Resident')
                        : 'Community Office'}
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                      {userIsVip && activeOfficeChat
                        ? (activeOfficeChat.residentPhone ? `Tel: ${activeOfficeChat.residentPhone}` : 'Direct Resident Inquiry')
                        : 'Concierge & Front Office • (904) 555-0100 • Clubhouse'}
                    </p>
                  </div>
                </div>

                {userIsVip && activeOfficeChat?.residentPhone ? (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText?.(activeOfficeChat.residentPhone || '');
                      showToast(`Copied ${activeOfficeChat.residentPhone}`);
                    }}
                    className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                  >
                    Copy Phone
                  </button>
                ) : (
                  !userIsVip && (
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText?.('(904) 555-0100');
                        showToast('Copied (904) 555-0100');
                      }}
                      className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                    >
                      Copy Phone
                    </button>
                  )
                )}
              </div>

              {/* Conversation Messages Thread */}
              <div className="flex-1 overflow-y-auto hide-scrollbar native-scroll space-y-3 p-2.5 rounded-2xl liquid-glass-subpanel pr-2 overscroll-contain touch-pan-y">
                {activeOfficeChat && activeOfficeChat.messages && activeOfficeChat.messages.length > 0 ? (
                  activeOfficeChat.messages.map((m) => {
                    if (userIsVip) {
                      // VIP PERSPECTIVE:
                      // VIP sees which resident they're chatting with, and their own replies as You (Community Office)
                      const isFromVip = m.senderRole === 'vip' || m.senderId === String(currentUser?.id || currentUser?.email);

                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isFromVip ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            {isFromVip ? (
                              <Building2 className="w-3.5 h-3.5 text-blue-600 inline-block" />
                            ) : null}
                            <span className="text-[11px] font-bold text-stone-600 dark:text-slate-300">
                              {isFromVip
                                ? 'You (Community Office)'
                                : `${activeOfficeChat.residentName} (Resident)`}
                            </span>
                            <span className="text-[10px] text-stone-400">{m.time}</span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                              isFromVip
                                ? 'bg-blue-600 text-white rounded-br-xs'
                                : 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-bl-xs'
                            }`}
                          >
                            {m.body}
                          </div>
                        </div>
                      );
                    } else {
                      // RESIDENT PERSPECTIVE:
                      // Resident only sees "Community Office" — never knows the personal identity or name of the VIP
                      const isFromResident = m.senderRole !== 'vip';

                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isFromResident ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            {!isFromResident && (
                              <Building2 className="w-3.5 h-3.5 text-blue-600 inline-block" />
                            )}
                            <span className="text-[11px] font-bold text-stone-600 dark:text-slate-300">
                              {isFromResident ? 'You' : 'Community Office'}
                            </span>
                            <span className="text-[10px] text-stone-400">{m.time}</span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                              isFromResident
                                ? 'bg-emerald-600 text-white rounded-br-xs'
                                : 'bg-blue-50 text-blue-950 dark:bg-slate-800 dark:text-blue-200 border border-blue-200 dark:border-slate-700 rounded-bl-xs'
                            }`}
                          >
                            {m.body}
                          </div>
                        </div>
                      );
                    }
                  })
                ) : (
                  <div className="text-center py-10 text-stone-400 dark:text-slate-500 space-y-2">
                    <Building2 className="w-10 h-10 mx-auto opacity-70 text-blue-600" />
                    <p className="text-xs sm:text-sm font-semibold">
                      {userIsVip ? 'No previous messages in this resident inquiry.' : 'Send an inquiry to the Community Office.'}
                    </p>
                    <p className="text-[11px] text-stone-400 max-w-xs mx-auto">
                      {userIsVip
                        ? 'Your replies appear to the resident as Community Office, keeping staff personal profiles private.'
                        : 'Our Community Office team will receive your message and respond directly here.'}
                    </p>
                  </div>
                )}
                <div ref={officeChatEndRef} />
              </div>

              {/* Inline Office Reply Input */}
              <form onSubmit={handleSendInlineOfficeReply} className="flex gap-2 items-center pt-1 shrink-0">
                <input
                  type="text"
                  value={officeReplyText}
                  onChange={(e) => setOfficeReplyText(e.target.value)}
                  placeholder={
                    userIsVip
                      ? `Reply as Community Office to ${activeOfficeChat?.residentName || 'resident'}...`
                      : 'Type a message to Community Office...'
                  }
                  className="flex-1 py-2.5 px-3.5 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  disabled={isSendingOfficeReply}
                />
                <button
                  type="submit"
                  disabled={!officeReplyText.trim() || isSendingOfficeReply}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          )}

          {/* ================= VIEW 2D: RESIDENT / FRIEND CHAT VIEW (INTERACTIVE & PERSISTENT) ================= */}
          {activeView === 'inbox' && selectedMessage && selectedMessage.senderCategory === 'friend' && (
            <div className="space-y-3 flex flex-col h-[520px] sm:h-[580px]">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 pr-11 sm:pr-12 shrink-0 gap-2">
                <button
                  onClick={() => {
                    setSelectedMessage(null);
                    setActiveFriendChat(null);
                  }}
                  className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>All Messages</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800">
                    <Users className="w-3.5 h-3.5 inline-block" />
                    <span>Resident Friend</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMessage(selectedMessage, e)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition cursor-pointer shrink-0"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat Subject / Info Banner */}
              <div className="liquid-glass-subpanel p-3 rounded-2xl flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    <UserAvatar
                      src={selectedMessage.senderAvatar}
                      name={selectedMessage.from}
                      size="sm"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold truncate">
                      {selectedMessage.from.replace(/\s*\([^)]*\)/g, '').trim()}
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                      {selectedMessage.senderPhone ? `Tel: ${selectedMessage.senderPhone}` : 'Community Resident'}
                    </p>
                  </div>
                </div>
                {selectedMessage.senderPhone && (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText?.(selectedMessage.senderPhone || '');
                      showToast(`Copied ${selectedMessage.senderPhone}`);
                    }}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                  >
                    Copy Phone
                  </button>
                )}
              </div>

              {/* Conversation Messages Thread */}
              <div className="flex-1 overflow-y-auto hide-scrollbar native-scroll space-y-3 p-2.5 rounded-2xl liquid-glass-subpanel pr-2 overscroll-contain touch-pan-y">
                {activeFriendChat && activeFriendChat.messages && activeFriendChat.messages.length > 0 ? (
                  activeFriendChat.messages.map((m) => {
                    const myKey = getCleanParticipantKey(currentUser);
                    const isFromMe = m.senderId === myKey || m.senderId === String(currentUser?.id) || m.senderId === currentUser?.email;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-bold text-stone-600 dark:text-slate-300">
                            {isFromMe ? 'You' : m.senderName}
                          </span>
                          <span className="text-[10px] text-stone-400">{m.time}</span>
                        </div>
                        <div
                          className={`p-3 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                            isFromMe
                              ? 'bg-emerald-600 text-white rounded-br-xs'
                              : 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-bl-xs'
                          }`}
                        >
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-bold text-stone-600 dark:text-slate-300">
                          {selectedMessage.from}
                        </span>
                        <span className="text-[10px] text-stone-400">{selectedMessage.time}</span>
                      </div>
                      <div className="p-3 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-bl-xs">
                        {selectedMessage.body}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={friendChatEndRef} />
              </div>

              {/* Inline Reply Input */}
              <form onSubmit={handleSendInlineFriendReply} className="flex gap-2 items-center pt-1 shrink-0">
                <input
                  type="text"
                  value={friendReplyText}
                  onChange={(e) => setFriendReplyText(e.target.value)}
                  placeholder={`Reply to ${selectedMessage.from.split(' ')[0]}...`}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-stone-900 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!friendReplyText.trim() || isSendingFriendReply}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
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
                  className={`liquid-glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm outline-none transition ${
                    internalDarkMode
                      ? 'text-white placeholder:text-slate-400'
                      : 'text-stone-900 placeholder:text-stone-500'
                  }`}
                />
              </div>

              {/* Notice that tapping a resident shows phone number and address */}
              <p className="text-xs text-stone-500 dark:text-slate-400 text-center">
                Tap on any resident to view phone number, address & profile.
              </p>

              {/* Residents List - Clean native app flow with NO browser scrollbars */}
              <div className="space-y-2.5 w-full">
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
                      className="liquid-glass-subpanel liquid-glass-subpanel-interactive p-3 sm:p-3.5 rounded-2xl flex items-center justify-between transition cursor-pointer group"
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
                className="liquid-glass-subpanel p-5 rounded-3xl text-center space-y-2.5 relative overflow-hidden"
              >
                <div className="relative inline-block mx-auto">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-3 border-emerald-600/50 shadow-md flex items-center justify-center">
                    <UserAvatar
                      src={selectedResident.photo}
                      name={selectedResident.name}
                      size="xl"
                      className="w-full h-full text-2xl"
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
                  <h3 className="text-xl sm:text-2xl font-black serif-title text-stone-900 dark:text-white">
                    {selectedResident.name}
                  </h3>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {selectedResident.apt} • {selectedResident.wing}
                  </p>
                  <p className="text-[14px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    TownLoop Resident since {selectedResident.residentSince}
                  </p>
                </div>
              </div>

              {/* Phone & Address Cards */}
              <div className="space-y-2.5">
                {/* Phone Card with Direct Call & Copy */}
                <div
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-stone-400 tracking-wider">
                        Phone Number
                      </p>
                      <p className="text-sm sm:text-base font-black text-stone-900 dark:text-white">
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
                      className="p-2 rounded-xl liquid-glass-subpanel hover:bg-white/40 text-stone-700 dark:text-slate-200 transition cursor-pointer"
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
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-stone-400 tracking-wider">
                        Address / Villa
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-white leading-relaxed mt-0.5">
                        {selectedResident.address}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText?.(selectedResident.address);
                      showToast('Address copied to clipboard');
                    }}
                    className="p-2 rounded-xl liquid-glass-subpanel hover:bg-white/40 text-stone-700 dark:text-slate-200 transition cursor-pointer shrink-0 mt-0.5"
                    title="Copy address"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* Hobbies / Interests */}
                <div
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl"
                >
                  <p className="text-xs uppercase font-bold text-stone-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Activities & Interests</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedResident.interests.map(interest => (
                      <span
                        key={interest}
                        className="px-3 py-1 rounded-full text-xs font-bold liquid-glass-subpanel text-stone-700 dark:text-slate-300"
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
              <div className="relative flex items-center justify-center pb-2.5 border-b border-stone-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveView('inbox')}
                  className="absolute left-0 flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Cancel
                </button>
                <span className="text-sm font-black uppercase tracking-wider text-stone-700 dark:text-slate-200 text-center">
                  New Message
                </span>
              </div>

              <form onSubmit={handleSendComposedMessage} className="space-y-3 pt-1">
                {/* 1. Choose Neighbor / Friend (TOP position for switching friend) */}
                {composeRecipient.category === 'friend' && residents.length > 0 && (
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-stone-600 dark:text-slate-300 mb-1">
                      Choose Neighbor / Friend
                    </label>
                    <div className="relative" ref={friendDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsFriendDropdownOpen((prev) => !prev)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 hover:bg-stone-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-stone-900 dark:text-slate-100 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-2xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {composeRecipient.name ? composeRecipient.name.charAt(0) : '👤'}
                          </span>
                          <span
                            className={`font-bold truncate ${
                              composeRecipient.name
                                ? 'text-stone-900 dark:text-slate-100'
                                : 'text-stone-400 dark:text-slate-500 font-medium'
                            }`}
                          >
                            {composeRecipient.name
                              ? `${composeRecipient.name} ${composeRecipient.apt ? `(${composeRecipient.apt})` : ''}`
                              : 'Select a Neighbor / Friend...'}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-stone-500 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
                            isFriendDropdownOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                          }`}
                        />
                      </button>

                      {/* Custom Modern Light Grey Friend Selector Dropdown Menu */}
                      <AnimatePresence>
                        {isFriendDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 backdrop-blur-2xl border border-stone-200 dark:border-slate-700/90 rounded-2xl shadow-xl overflow-hidden p-1.5 max-h-60 overflow-y-auto space-y-1 hide-scrollbar"
                          >
                            {residents.map((r) => {
                              const isSelected = r.name === composeRecipient.name;
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => {
                                    setComposeRecipient({
                                      name: r.name,
                                      category: 'friend',
                                      role: `Resident (${r.apt})`,
                                      apt: r.apt,
                                      phone: r.phone,
                                    });
                                    setComposeSubject(`Hello ${r.name.split(' ')[0]}!`);
                                    setIsFriendDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-700 shadow-2xs'
                                      : 'bg-stone-50/90 hover:bg-stone-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-stone-800 dark:text-slate-200 border border-stone-200/60 dark:border-slate-700/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-stone-200/80 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                      {r.name.charAt(0)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs sm:text-sm font-bold truncate leading-tight text-stone-900 dark:text-slate-100">
                                        {r.name}
                                      </p>
                                      <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate font-normal mt-0.5">
                                        Apt {r.apt}
                                      </p>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* 2. Recipient Summary Card (BOTTOM position below selector) */}
                <div
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        composeRecipient.category === 'friend'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : composeRecipient.category === 'office'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {composeRecipient.category === 'friend' && <Users className="w-4 h-4" />}
                      {composeRecipient.category === 'office' && <Building2 className="w-4 h-4" />}
                      {composeRecipient.category === 'maintenance' && (
                        <img src="/crew-badge.svg" alt="Crew" className="w-4 h-4 object-contain inline-block" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase font-bold text-stone-400">Recipient</p>
                      <p
                        className={`text-sm sm:text-base truncate ${
                          composeRecipient.name
                            ? 'font-extrabold text-stone-900 dark:text-slate-100'
                            : 'font-medium italic text-stone-400 dark:text-slate-500'
                        }`}
                      >
                        {composeRecipient.name || 'No resident selected yet'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                      composeRecipient.category === 'friend'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : composeRecipient.category === 'office'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {composeRecipient.category === 'friend'
                      ? 'Friend'
                      : composeRecipient.category === 'office'
                      ? 'Office'
                      : 'Crew'}
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
                    className={`liquid-glass-input w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none ${
                      internalDarkMode
                        ? 'text-white placeholder:text-slate-500'
                        : 'text-stone-900 placeholder:text-stone-400'
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
                    className={`liquid-glass-input w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none resize-none ${
                      internalDarkMode
                        ? 'text-white placeholder:text-slate-500'
                        : 'text-stone-900 placeholder:text-stone-400'
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
              <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 dark:border-slate-800 pr-11 sm:pr-12">
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
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Home className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Residency Address</span>
                  </div>
                  <span className="font-bold text-right break-words max-w-[220px]">{effectiveAddress}</span>
                </div>

                <div
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Resident Phone</span>
                  </div>
                  <span className="font-bold text-right">{effectivePhone}</span>
                </div>

                <div
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between"
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
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 text-stone-600 dark:text-slate-300 font-medium">
                    <Heart className="w-5 h-5 text-rose-500 shrink-0" />
                    <span>Dietary Preference</span>
                  </div>
                  <span className="font-bold text-right">{effectiveDietary}</span>
                </div>

                <div
                  className="liquid-glass-subpanel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between"
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
              </div>
            </div>
          )}

          {/* ================= VIEW 5: LOGOUT CONFIRMATION ================= */}
          {activeView === 'logoutConfirm' && (
            <div className="space-y-6 text-center py-6 px-2 flex flex-col items-center justify-center min-h-[280px] my-auto">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center shadow-md border border-rose-200/80 dark:border-rose-900/60 shrink-0">
                <LogOut className="w-8 h-8 sm:w-10 sm:h-10 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
              </div>

              <div className="space-y-2 max-w-sm mx-auto text-center">
                <h3 className="text-xl sm:text-2xl font-black serif-title text-stone-900 dark:text-slate-100 text-center leading-snug tracking-tight">
                  Log Out of Resident Portal?
                </h3>
                <p className="text-sm sm:text-base text-stone-600 dark:text-slate-300 font-medium leading-relaxed text-center">
                  You can easily sign back into your TownLoop account at any time.
                </p>
              </div>

              <div className="w-full max-w-sm mx-auto flex flex-col sm:flex-row gap-3 pt-2 justify-center items-center">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="w-full sm:flex-1 py-3.5 px-5 rounded-2xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 active:scale-98 text-stone-800 dark:text-slate-200 text-sm sm:text-base font-extrabold transition cursor-pointer border border-stone-200 dark:border-slate-700 flex items-center justify-center text-center shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full sm:flex-1 py-3.5 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-sm sm:text-base font-extrabold transition cursor-pointer shadow-md flex items-center justify-center gap-2 text-center"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Yes, Log Out</span>
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
          className="group relative block rounded-full focus:outline-none transition-all duration-300 active:scale-90 active:rotate-[-2deg] ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer"
          title="Open Resident Profile & Menu"
          aria-label="Open Resident Profile & Menu"
        >
          <div
            className={`relative ${
              isLarge ? 'w-16 h-16 sm:w-[70px] sm:h-[70px]' : 'w-11 h-11'
            } rounded-full overflow-hidden border-2 border-emerald-600/40 shadow-sm bg-stone-100 group-hover:shadow-md group-hover:border-emerald-500/80 transition-all duration-300 group-hover:scale-105 active:scale-95`}
          >
            <UserAvatar
              src={profilePhotoUrl}
              name={effectiveName}
              className="w-full h-full object-cover transition duration-300"
            />
            <div className="absolute inset-0 bg-emerald-700/10 mix-blend-multiply" />
            {/* Subtle liquid sheen on avatar hover / interaction */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        </button>

        {/* VIP, Staff & Admin Role Staff Badge: Displayed at bottom-left outline of the profile picture */}
        {(isAdmin(currentUser) || isStaff(currentUser) || isStrictVip(currentUser)) && (
          <div
            className="absolute bottom-0 left-0 -translate-x-0.5 translate-y-0.5 z-10 pointer-events-none drop-shadow-md"
            title={isAdmin(currentUser) ? "Admin Staff Badge" : isStaff(currentUser) ? "Staff Badge" : "VIP Staff Badge"}
          >
            <VipStaffBadge
              size={size}
              role={isAdmin(currentUser) ? 'admin' : isStaff(currentUser) ? 'staff' : 'vip'}
              title={isAdmin(currentUser) ? "Admin Staff Badge" : isStaff(currentUser) ? "Staff Badge" : "VIP Staff Badge"}
            />
          </div>
        )}

        {/* Crew Role Badge: Displayed at bottom-left outline of the profile picture */}
        {(isCrew(currentUser) || getUserRole(currentUser) === 'crew') && (
          <div
            className="absolute bottom-0 left-0 -translate-x-0.5 translate-y-0.5 z-10 pointer-events-none drop-shadow-md"
            title="Crew Badge"
          >
            <img 
              src="/crew-badge.svg" 
              alt="Crew Badge" 
              className={`${
                isLarge ? 'w-6 h-6 sm:w-6.5 sm:h-6.5' : 'w-4.5 h-4.5 sm:w-5 sm:h-5'
              } object-contain inline-block`} 
            />
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
