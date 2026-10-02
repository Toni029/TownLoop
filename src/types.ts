export interface TaskItem {
  id: number;
  text: string;
  date: string;
  done: boolean;
}

export interface ActivityEvent {
  id: number;
  title: string;
  time: string;
  location: string;
  attending: boolean;
}

export type UserRole = 'admin' | 'staff' | 'vip' | 'crew' | 'resident' | '';

export interface WorkOrderComment {
  id: number | string;
  author: string;
  role: string;
  text: string;
  timestamp: string;
  photoUrl?: string;
}

export interface WorkOrderItem {
  id: number | string;
  code: string;
  title: string;
  description?: string;
  category: string;
  categoryEmoji?: string;
  unit: string;
  placeInLine: number;
  aheadCount: number;
  status: 'In Progress' | 'Queued' | 'Submitted' | 'Done' | 'Pending';
  statusNote: string;
  timeAgo: string;
  completedAt?: string;
  completedBy?: string;
  photoUrl?: string;
  photos?: string[];
  comments?: WorkOrderComment[];
  userId?: string | number;
  userEmail?: string;
  userName?: string;
}

export interface CommentItem {
  id: number | string;
  author: string;
  authorAvatar?: string;
  authorId?: string | number;
  authorEmail?: string;
  unit?: string;
  text: string;
  timeAgo: string;
  likes?: number;
  liked?: boolean;
}

export interface MediaAttachment {
  type: 'image' | 'video';
  url: string;
  name?: string;
}

export interface PostItem {
  id: number | string;
  author: string;
  authorAvatar?: string;
  authorId?: string | number;
  authorEmail?: string;
  unit: string;
  timeAgo: string;
  tag: string;
  title: string;
  content: string;
  mediaUrl?: string;
  media?: MediaAttachment[];
  likes: number;
  liked: boolean;
  comments: CommentItem[];
}

export interface MarketItem {
  id: number | string;
  title: string;
  price: string;
  description: string;
  author: string;
  authorAvatar?: string;
  authorId?: string | number;
  authorEmail?: string;
  unit: string;
  timeAgo?: string;
  isOwner: boolean;
  claimed: boolean;
  sold?: boolean;
  mediaUrl?: string;
  photoUrl?: string;
  photos?: string[];
  media?: MediaAttachment[];
  comments?: CommentItem[];
}

export interface RsvpAttendee {
  id: string;
  userId?: string;
  name: string;
  unit?: string;
  email?: string;
  avatar?: string;
  role?: string;
  rsvpdAt: number | string;
}

export interface CommunityRsvpEvent {
  id: number | string;
  title: string;
  month: string;
  day: string;
  time: string;
  location: string;
  category: string;
  attendeesCount: number;
  userRsvp: boolean;
  description: string;
  spotsLeft?: number;
  capacity?: number | null;
  createdBy?: string;
  createdAt?: number;
  isAiExtracted?: boolean;
  deadline?: string;
  attendees?: RsvpAttendee[];
  newsletterId?: string;
  editionMonth?: string;
}

export interface PinnedHighlight {
  id: string;
  title: string;
  category: string;
  authorLabel: string;
  description: string;
  date?: string;
  tag?: string;
  summary?: string;
  createdAt?: number;
  isAiExtracted?: boolean;
  newsletterId?: string;
  editionMonth?: string;
}

export interface ExtractedRsvpEventInput {
  title: string;
  month: string;
  day: string | number;
  time: string;
  location: string;
  category: string;
  capacity: number | null;
  description: string;
  deadline?: string;
}

export interface ExtractedPinnedHighlightInput {
  title: string;
  date: string;
  summary: string;
  tag: string;
}

export interface NewsletterAiExtractionResult {
  rsvp_events: ExtractedRsvpEventInput[];
  pinned_highlights: ExtractedPinnedHighlightInput[];
  source: 'gemini' | 'fallback';
  meta?: {
    editionTitle?: string;
    eventsCount: number;
    highlightsCount: number;
  };
}

export interface NewsletterConfig {
  id: string;
  editionTitle: string;
  monthEdition: string;
  description: string;
  pdfUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: string;
  pageImages?: string[];
  uploadedAt?: number;
  uploadedBy?: string;
  lastExtractedAt?: number;
  isCustomUpload?: boolean;
  isRemoved?: boolean;
}

export interface UserProfile {
  id: string | number;
  name: string;
  email: string;
  role?: UserRole;
  unit?: string;
  address?: string;
  apartment_number?: string;
  apartmentNumber?: string;
  wing?: string;
  phone?: string;
  emergency_contact?: string;
  emergencyContact?: string;
  dietary_preference?: string;
  dietaryPreference?: string;
  avatar?: string;
  avatar_url?: string;
  avatarUrl?: string;
  approved?: boolean;
  isAdmin?: boolean;
  isStaff?: boolean;
  isVip?: boolean;
  isCrew?: boolean;
  created_at?: string;
  createdAt?: string;
}

export type MedicationTimeSlot = 'morning' | 'noon' | 'evening' | 'bedtime';

export interface MedicationItem {
  id: string;
  name: string;
  doseCount: number;
  timeSlot: MedicationTimeSlot;
  bottleCount: number;
  instructions?: string;
  lastTakenDate?: string; // YYYY-MM-DD
  lastTakenTime?: string; // e.g. 8:15 AM
  pharmacyPhone?: string;
  createdAt: number;
}

export type PortalTab = 'home' | 'news' | 'workorders' | 'social';

export interface MaintenanceChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'resident' | 'crew' | 'admin' | string;
  senderAvatar?: string;
  body: string;
  createdAt: number;
  time: string;
}

export interface MaintenanceChat {
  id: string; // residentId
  residentId: string;
  residentName: string;
  residentEmail: string;
  residentApt: string;
  residentPhone?: string;
  residentAvatar?: string;
  subject: string;
  lastMessage: string;
  updatedAt: number;
  unreadByCrew: boolean;
  unreadByResident: boolean;
  messages: MaintenanceChatMessage[];
}

export interface OfficeChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'resident' | 'vip' | 'admin' | string;
  senderAvatar?: string;
  body: string;
  createdAt: number;
  time: string;
}

export interface OfficeChat {
  id: string; // residentId
  residentId: string;
  residentName: string;
  residentEmail: string;
  residentApt: string;
  residentPhone?: string;
  residentAvatar?: string;
  subject: string;
  lastMessage: string;
  updatedAt: number;
  unreadByVip: boolean;
  unreadByResident: boolean;
  messages: OfficeChatMessage[];
}

export interface ResidentChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  body: string;
  createdAt: number;
  time: string;
}

export interface ResidentChatParticipant {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  phone?: string;
  apt?: string;
}

export interface ResidentChat {
  id: string; // canonical pair id, e.g. "user1_vs_user2"
  participantIds: string[];
  participants: ResidentChatParticipant[];
  subject: string;
  lastMessage: string;
  updatedAt: number;
  unreadBy: string[]; // ids of participants who haven't read latest
  messages: ResidentChatMessage[];
}


