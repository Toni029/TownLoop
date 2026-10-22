import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PostItem,
  MarketItem,
  MediaAttachment,
  UserProfile,
} from '../types';
import {
  saveDiscussionFeedPostToFirestore,
  saveMarketplacePostToFirestore,
} from '../services/firestoreSync';
import { subscribeToCommunityDirectory } from '../services/auth';
import { mutateSocial } from '../services/socialIntegrity';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';
import {
  MarketplaceChat,
  subscribeMarketplaceChats,
  sendMarketplaceInquiry,
} from '../services/marketplaceChat';

const STORAGE_POSTS_KEY = 'portal_discussion_posts';
const STORAGE_MARKET_KEY = 'portal_marketplace_items';
export interface CommunityState {
  currentUser?: UserProfile | null;
  posts: PostItem[];
  setPosts: React.Dispatch<React.SetStateAction<PostItem[]>>;
  marketItems: MarketItem[];
  setMarketItems: React.Dispatch<React.SetStateAction<MarketItem[]>>;
  socialView: 'chat' | 'market';
  setSocialView: React.Dispatch<React.SetStateAction<'chat' | 'market'>>;
  isCreatePostModalOpen: boolean;
  setIsCreatePostModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDetailPost: PostItem | null;
  setSelectedDetailPost: React.Dispatch<React.SetStateAction<PostItem | null>>;
  selectedDetailMarket: MarketItem | null;
  setSelectedDetailMarket: React.Dispatch<React.SetStateAction<MarketItem | null>>;
  selectedMessageSellerItem: MarketItem | null;
  setSelectedMessageSellerItem: React.Dispatch<React.SetStateAction<MarketItem | null>>;
  isMessageSellerModalOpen: boolean;
  setIsMessageSellerModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  marketplaceChats: MarketplaceChat[];
  setMarketplaceChats: React.Dispatch<React.SetStateAction<MarketplaceChat[]>>;
  isMarketplaceChatModalOpen: boolean;
  setIsMarketplaceChatModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeMarketplaceChatId: string | null;
  setActiveMarketplaceChatId: React.Dispatch<React.SetStateAction<string | null>>;
  fullscreenMedia: {
    media: MediaAttachment[];
    initialIndex?: number;
    title?: string;
    author?: string;
  } | null;
  setFullscreenMedia: React.Dispatch<
    React.SetStateAction<{
      media: MediaAttachment[];
      initialIndex?: number;
      title?: string;
      author?: string;
    } | null>
  >;
  toggleLike: (id: number | string) => Promise<boolean>;
  openCommentsPostId: number | string | null;
  setOpenCommentsPostId: React.Dispatch<React.SetStateAction<number | string | null>>;
  commentInputText: { [postId: string]: string };
  setCommentInputText: React.Dispatch<React.SetStateAction<{ [postId: string]: string }>>;
  handleAddComment: (postId: number | string) => Promise<boolean>;
  handleModalAddComment: (targetId: number | string, text: string, isMarket?: boolean) => Promise<boolean>;
  isItemCreator: (item?: PostItem | MarketItem | null) => boolean;
  handleDeleteItem: (id: number | string, isMarket?: boolean) => Promise<boolean>;
  handleToggleSoldItem: (id: number | string) => Promise<boolean>;
  handleOpenMessageSeller: (item: MarketItem) => void;
  handleSendMessageToSeller: (
    itemOrRecipient: MarketItem | string,
    messageText?: string,
    messageId?: string
  ) => Promise<void | boolean> | void;
  handleCreatePostSubmit: (payload: {
    type: 'chat' | 'market';
    recordId?: string;
    title: string;
    description: string;
    price?: string;
    media: MediaAttachment[];
    mediaUrl?: string;
  }) => Promise<void> | void;
}

export function useCommunityState(
  currentUser?: UserProfile | null,
  showToast?: (message: string) => void
): CommunityState {
  const collectionScope = currentUser?.approved === true ? `${currentUser.id}:${currentUser.role}` : '';
  const [chatScope, setChatScope] = useState('');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);

  const [socialView, setSocialView] = useState<'chat' | 'market'>('chat');
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [selectedDetailPost, setSelectedDetailPost] = useState<PostItem | null>(null);
  const [selectedDetailMarket, setSelectedDetailMarket] = useState<MarketItem | null>(null);
  const [selectedMessageSellerItem, setSelectedMessageSellerItem] = useState<MarketItem | null>(
    null
  );
  const [isMessageSellerModalOpen, setIsMessageSellerModalOpen] = useState(false);
  const [marketplaceChats, setMarketplaceChats] = useState<MarketplaceChat[]>([]);
  const [isMarketplaceChatModalOpen, setIsMarketplaceChatModalOpen] = useState(false);
  const [activeMarketplaceChatId, setActiveMarketplaceChatId] = useState<string | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{
    media: MediaAttachment[];
    initialIndex?: number;
    title?: string;
    author?: string;
  } | null>(null);

  const [openCommentsPostId, setOpenCommentsPostId] = useState<number | string | null>(null);
  const [commentInputText, setCommentInputText] = useState<{ [postId: string]: string }>({});

  // Subscribe to Marketplace Chats
  useEffect(() => {
    let alive = true;
    setMarketplaceChats([]);
    setChatScope(collectionScope);
    const unsub = subscribeMarketplaceChats(currentUser, (chats) => {
      if (alive) setMarketplaceChats(chats);
    });
    return () => { alive = false; unsub(); };
  }, [collectionScope]);
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);
  // Discard the former persistent cache, which could contain private profile fields.
  useEffect(() => {
    try { localStorage.removeItem('portal_community_directory_users'); } catch {}
  }, []);
  useEffect(() => {
    setDirectoryUsers([]);
    if (!currentUser || currentUser.approved !== true) return;
    let alive = true;
    const stop = subscribeToCommunityDirectory(users => { if (alive) setDirectoryUsers(users); });
    return () => { alive = false; stop(); };
  }, [currentUser?.id, currentUser?.approved, currentUser?.role]);

  const resolveAvatar = useCallback(
    (
      rawAvatar?: string,
      authorId?: string | number,
      authorEmail?: string,
      authorName?: string
    ): string => {
      // Check current user match first for instant real-time resolution
      if (currentUser) {
        const myAvatar = currentUser.avatarUrl || currentUser.avatar_url || (currentUser as any).avatar;
        if (myAvatar && typeof myAvatar === 'string' && myAvatar.trim()) {
          const idMatch = Boolean(authorId && String(authorId) === String(currentUser.id));
          const emailMatch = Boolean(
            authorEmail &&
              currentUser.email &&
              authorEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
          );
          const nameMatch = Boolean(
            authorName &&
              currentUser.name &&
              authorName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
          );
          if (idMatch || emailMatch || nameMatch) {
            return myAvatar.trim();
          }
        }
      }

      if (rawAvatar && typeof rawAvatar === 'string' && rawAvatar.trim() && rawAvatar !== 'undefined' && rawAvatar !== 'null') {
        return rawAvatar.trim();
      }

      // Check community directory match
      if (directoryUsers && directoryUsers.length > 0) {
        const cleanAuthorName = (authorName || '').toLowerCase().trim();
        const cleanAuthorEmail = (authorEmail || '').toLowerCase().trim();
        const cleanAuthorId = authorId ? String(authorId).trim() : '';

        const found = directoryUsers.find((u) => {
          if (cleanAuthorId && (String(u.id) === cleanAuthorId || String(u.uid) === cleanAuthorId)) return true;
          if (cleanAuthorEmail && u.email && cleanAuthorEmail === String(u.email).toLowerCase().trim()) return true;
          if (cleanAuthorName && u.name && cleanAuthorName === String(u.name).toLowerCase().trim()) return true;
          return false;
        });

        if (found) {
          const dirAvatar = found.avatarUrl || found.avatar_url || found.avatar || found.photoUrl || found.photoURL || found.photo;
          if (dirAvatar && typeof dirAvatar === 'string' && dirAvatar.trim()) {
            return dirAvatar.trim();
          }
        }
      }

      return rawAvatar?.trim() || '';
    },
    [currentUser, directoryUsers]
  );

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_POSTS_KEY);
      localStorage.removeItem(STORAGE_MARKET_KEY);
      localStorage.removeItem('townloop_liked_posts_v1');
    } catch {}
  }, []);

  // Avatar/profile edits update the rendered records below without replacing Firestore listeners.
  const avatarResolver = useRef(resolveAvatar);
  avatarResolver.current = resolveAvatar;
  const activeCollectionScope = useRef(collectionScope);
  activeCollectionScope.current = collectionScope;
  const [loadedCollectionScope, setLoadedCollectionScope] = useState('');

  // Firestore live subscriptions
  useEffect(() => {
    if (!isFirebaseConfigured() || !db || currentUser?.approved !== true) {
      setPosts([]); setMarketItems([]); return;
    }
    let alive = true;
    const ownsScope = () => alive && activeCollectionScope.current === collectionScope;
    setPosts([]); setMarketItems([]);
    setSelectedDetailPost(null); setSelectedDetailMarket(null);
    setLoadedCollectionScope(collectionScope);
    let unsubPosts = () => {};
    let unsubMarket = () => {};
    try {
      const qPosts = query(collection(db, 'discussion_feed'), where('storageDraft', '==', false), orderBy('createdAt', 'desc'));
      unsubPosts = onSnapshot(
        qPosts,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!ownsScope() || snapshot.metadata.hasPendingWrites) return;
          const remotePosts: PostItem[] = snapshot.docs.map((doc) => {
            const d = doc.data();
            const rawAvatar = d.authorAvatar || d.author_avatar || d.avatarUrl || d.avatar_url || d.photoUrl || d.photoURL || d.avatar || d.userAvatar || '';
            const authorId = d.userId || d.authorId || d.uid;
            const authorEmail = d.authorEmail || d.email || '';
            const author = d.author || 'Resident';
            const resolvedAvatar = avatarResolver.current(rawAvatar, authorId, authorEmail, author);

            return {
              id: doc.id,
              author,
              authorAvatar: resolvedAvatar,
              authorId,
              authorEmail,
              unit: d.unit || 'TownLoop Resident',
              timeAgo: d.timeAgo || 'Recent',
              tag: d.tag || 'Community',
              title: d.title || 'Community Post',
              content: d.content || '',
              mediaUrl: d.mediaUrl,
              media: d.media || (d.mediaUrl ? [{ type: 'image', url: d.mediaUrl }] : []),
              likes: d.likes || 0,
              liked: !!currentUser?.id && d.likedBy?.[String(currentUser.id)] === true,
              comments: (d.comments || []).map((c: any) => ({
                ...c,
                authorAvatar: avatarResolver.current(c.authorAvatar || c.avatarUrl || c.avatar, c.authorId || c.userId, c.authorEmail || c.email, c.author),
              })),
            };
          });
          setPosts(remotePosts);
          setSelectedDetailPost(selected => selected ? remotePosts.find(post => String(post.id) === String(selected.id)) || null : null);
        },
        (err) => { if (ownsScope()) { setPosts([]); setSelectedDetailPost(null); } console.warn('Firestore discussion listener error:', err); }
      );

      const qMarket = query(collection(db, 'marketplace_posts'), where('storageDraft', '==', false), orderBy('createdAt', 'desc'));
      unsubMarket = onSnapshot(
        qMarket,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!ownsScope() || snapshot.metadata.hasPendingWrites) return;
          const remoteMarket: MarketItem[] = snapshot.docs.map((doc) => {
            const d = doc.data();
            const rawAvatar = d.authorAvatar || d.author_avatar || d.avatarUrl || d.avatar_url || d.photoUrl || d.photoURL || d.avatar || d.userAvatar || '';
            const authorId = d.userId || d.authorId || d.uid;
            const authorEmail = d.authorEmail || d.email || '';
            const author = d.author || 'Resident';
            const resolvedAvatar = avatarResolver.current(rawAvatar, authorId, authorEmail, author);

            const isOwner = !!currentUser?.id && authorId === String(currentUser.id);

            return {
              id: doc.id,
              title: d.title || 'Market Item',
              price: d.price || 'FREE',
              description: d.description || '',
              author,
              authorAvatar: resolvedAvatar,
              authorId,
              authorEmail,
              unit: d.unit || 'TownLoop Resident',
              timeAgo: d.timeAgo || 'Recent',
              isOwner,
              claimed: Boolean(d.claimed || d.sold),
              sold: Boolean(d.sold || d.claimed),
              mediaUrl: d.mediaUrl,
              photoUrl: d.mediaUrl,
              media: d.media || (d.mediaUrl ? [{ type: 'image', url: d.mediaUrl }] : []),
              comments: (d.comments || []).map((c: any) => ({
                ...c,
                authorAvatar: avatarResolver.current(c.authorAvatar || c.avatarUrl || c.avatar, c.authorId || c.userId, c.authorEmail || c.email, c.author),
              })),
            };
          });
          setMarketItems(remoteMarket);
          setSelectedDetailMarket(selected => selected ? remoteMarket.find(item => String(item.id) === String(selected.id)) || null : null);
        },
        (err) => { if (ownsScope()) { setMarketItems([]); setSelectedDetailMarket(null); } console.warn('Firestore marketplace listener error:', err); }
      );

      return () => {
        alive = false;
        unsubPosts();
        unsubMarket();
      };
    } catch (err) {
      alive = false;
      unsubPosts(); unsubMarket();
      console.warn('Failed to attach Firestore community listeners:', err);
    }
  }, [collectionScope]);

  // Sync avatar updates when directory or current user profile picture changes
  useEffect(() => {
    setPosts((prev) =>
      prev.map((p) => {
        const resolved = resolveAvatar(p.authorAvatar, p.authorId, p.authorEmail, p.author);
        const updatedComments = (p.comments || []).map((c) => ({
          ...c,
          authorAvatar: resolveAvatar(c.authorAvatar, c.authorId, c.authorEmail, c.author),
        }));
        return {
          ...p,
          authorAvatar: resolved || p.authorAvatar,
          comments: updatedComments,
        };
      })
    );
    setMarketItems((prev) =>
      prev.map((m) => {
        const resolved = resolveAvatar(m.authorAvatar, m.authorId, m.authorEmail, m.author);
        const updatedComments = (m.comments || []).map((c) => ({
          ...c,
          authorAvatar: resolveAvatar(c.authorAvatar, c.authorId, c.authorEmail, c.author),
        }));
        return {
          ...m,
          authorAvatar: resolved || m.authorAvatar,
          comments: updatedComments,
        };
      })
    );
  }, [directoryUsers, currentUser, resolveAvatar]);

  const actorUid = useCallback(() => {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid || currentUser?.approved !== true || uid !== String(currentUser.id))
      throw Error('Please sign in to an approved account.');
    return uid;
  }, [currentUser]);
  const commentAttempts = useRef(new Map<string, string>());
  const sendComment = useCallback(async (collection: 'discussion_feed' | 'marketplace_posts', id: string, text: string) => {
    const uid = actorUid();
    const key = JSON.stringify([uid, collection, id, text.trim()]);
    const commentId = commentAttempts.current.get(key) || crypto.randomUUID();
    commentAttempts.current.set(key, commentId);
    await mutateSocial(db!, uid, collection, id, 'comment', { text, commentId });
    commentAttempts.current.delete(key);
  }, [actorUid]);
  const toggleLike = useCallback(async (id: number | string) => {
    try {
      const item = posts.find(post => String(post.id) === String(id));
      if (!item) return false;
      await mutateSocial(db!, actorUid(), 'discussion_feed', String(id), 'like', { liked: !item.liked });
      return true;
    } catch (error) { showToast?.(error instanceof Error ? error.message : 'Could not update reaction.'); return false; }
  }, [posts, actorUid, showToast]);

  const handleAddComment = useCallback(async (postId: number | string) => {
    const text = (commentInputText[String(postId)] || '').trim();
    if (!text) return false;
    try {
      await sendComment('discussion_feed', String(postId), text);
      setCommentInputText(previous => previous[String(postId)]?.trim() === text ? { ...previous, [String(postId)]: '' } : previous);
      showToast?.('Comment posted!');
      return true;
    } catch (error) { showToast?.(error instanceof Error ? error.message : 'Could not post comment.'); return false; }
  }, [commentInputText, sendComment, showToast]);

  const handleModalAddComment = useCallback(async (targetId: number | string, text: string, isMarket?: boolean) => {
    if (!text.trim()) return false;
    const market = isMarket ?? (selectedDetailMarket != null && String(selectedDetailMarket.id) === String(targetId));
    try {
      await sendComment(market ? 'marketplace_posts' : 'discussion_feed', String(targetId), text);
      showToast?.('Comment posted!');
      return true;
    } catch (error) { showToast?.(error instanceof Error ? error.message : 'Could not post comment.'); return false; }
  }, [selectedDetailMarket, sendComment, showToast]);

  const isItemCreator = useCallback((item?: PostItem | MarketItem | null) =>
    !!item && !!currentUser?.id && item.authorId === String(currentUser.id), [currentUser]);

  const handleDeleteItem = useCallback(async (id: number | string, isMarket?: boolean) => {
    try {
      const market = isMarket ?? marketItems.some(item => String(item.id) === String(id));
      await mutateSocial(db!, actorUid(), market ? 'marketplace_posts' : 'discussion_feed', String(id), 'delete');
      if (market) setSelectedDetailMarket(null); else setSelectedDetailPost(null);
      showToast?.('Item deleted');
      return true;
    } catch (error) { showToast?.(error instanceof Error ? error.message : 'Could not delete item.'); return false; }
  }, [marketItems, actorUid, showToast]);

  const handleToggleSoldItem = useCallback(async (id: number | string) => {
    try {
      const item = marketItems.find(item => String(item.id) === String(id));
      if (!item) return false;
      await mutateSocial(db!, actorUid(), 'marketplace_posts', String(id), 'sold', { sold: !item.sold });
      showToast?.('Listing status updated');
      return true;
    } catch (error) { showToast?.(error instanceof Error ? error.message : 'Could not update listing.'); return false; }
  }, [marketItems, actorUid, showToast]);

  const handleOpenMessageSeller = useCallback((item: MarketItem) => {
    setSelectedMessageSellerItem(item);
    setIsMessageSellerModalOpen(true);
  }, []);

  const handleSendMessageToSeller = useCallback(
    async (itemOrRecipient: MarketItem | string, messageText?: string, messageId?: string) => {
      const effectiveBuyer = currentUser || {
        id: 'resident',
        name: 'Resident',
        email: '',
        role: 'resident',
      };

      if (typeof itemOrRecipient !== 'string' && messageText) {
        try {
          const chat = await sendMarketplaceInquiry({
            item: itemOrRecipient,
            buyer: effectiveBuyer,
            messageText,
            messageId,
          });

          // Instantly update local marketplaceChats React state
          setMarketplaceChats((prev) => {
            const filtered = prev.filter((c) => c.id !== chat.id);
            return [chat, ...filtered];
          });

          setIsMessageSellerModalOpen(false);
          setSelectedMessageSellerItem(null);
          setActiveMarketplaceChatId(chat.id);
          setIsMarketplaceChatModalOpen(true);
          showToast?.('Message sent to seller!');
          return;
        } catch (err) {
          showToast?.('Message was not confirmed. Your draft is kept; please retry.');
          return false;
        }
      }
      return false;
    },
    [currentUser, showToast]
  );

  const handleCreatePostSubmit = useCallback(async (payload: {
    type: 'chat' | 'market'; recordId?: string; title: string; description: string;
    price?: string; media: MediaAttachment[]; mediaUrl?: string;
  }) => {
    const userId = actorUid();
    const common = { id: payload.recordId, title: payload.title, userId,
      media: payload.media, mediaUrl: payload.mediaUrl || payload.media[0]?.url || '' };
    const id = payload.type === 'chat'
      ? await saveDiscussionFeedPostToFirestore({ ...common, content: payload.description })
      : await saveMarketplacePostToFirestore({ ...common, description: payload.description, price: payload.price || 'FREE' });
    if (!id) throw Error('Could not publish your post. Your draft is still available.');
    showToast?.(payload.type === 'chat' ? 'Community post shared!' : 'Marketplace listing created!');
  }, [actorUid, showToast]);

  return {
    currentUser,
    posts: loadedCollectionScope === collectionScope && collectionScope ? posts : [],
    setPosts,
    marketItems: loadedCollectionScope === collectionScope && collectionScope ? marketItems : [],
    setMarketItems,
    socialView,
    setSocialView,
    isCreatePostModalOpen,
    setIsCreatePostModalOpen,
    selectedDetailPost: loadedCollectionScope === collectionScope && collectionScope ? selectedDetailPost : null,
    setSelectedDetailPost,
    selectedDetailMarket: loadedCollectionScope === collectionScope && collectionScope ? selectedDetailMarket : null,
    setSelectedDetailMarket,
    selectedMessageSellerItem,
    setSelectedMessageSellerItem,
    isMessageSellerModalOpen,
    setIsMessageSellerModalOpen,
    marketplaceChats: collectionScope && chatScope === collectionScope ? marketplaceChats : [],
    setMarketplaceChats,
    isMarketplaceChatModalOpen,
    setIsMarketplaceChatModalOpen,
    activeMarketplaceChatId,
    setActiveMarketplaceChatId,
    fullscreenMedia,
    setFullscreenMedia,
    toggleLike,
    openCommentsPostId,
    setOpenCommentsPostId,
    commentInputText,
    setCommentInputText,
    handleAddComment,
    handleModalAddComment,
    isItemCreator,
    handleDeleteItem,
    handleToggleSoldItem,
    handleOpenMessageSeller,
    handleSendMessageToSeller,
    handleCreatePostSubmit,
  };
}
