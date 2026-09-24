import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  PostItem,
  MarketItem,
  CommentItem,
  MediaAttachment,
  UserProfile,
} from '../types';
import {
  saveDiscussionFeedPostToFirestore,
  saveMarketplacePostToFirestore,
  deleteDiscussionFeedPostFromFirestore,
  deleteMarketplacePostFromFirestore,
  updateFirestoreDocument,
} from '../services/firestoreSync';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

const STORAGE_POSTS_KEY = 'portal_discussion_posts';
const STORAGE_MARKET_KEY = 'portal_marketplace_items';

const INITIAL_POSTS: PostItem[] = [
  {
    id: 'post-1',
    author: 'Eleanor Vance',
    unit: 'Bldg 2 • Apt 204',
    timeAgo: '2h ago',
    tag: 'Garden & Nature',
    title: 'The Camellias are blooming near the North Pond!',
    content:
      'Took a morning stroll past the North Gazebo and the pink camellias are in full bloom. Highly recommend taking the paved loop today!',
    likes: 8,
    liked: false,
    comments: [
      {
        id: 'c1',
        author: 'Robert Hayes',
        unit: 'Apt 112',
        text: 'Saw them too! Simply stunning this time of year.',
        timeAgo: '1h ago',
      },
    ],
  },
  {
    id: 'post-2',
    author: 'Arthur Pendelton',
    unit: 'Bldg 1 • Apt 105',
    timeAgo: '5h ago',
    tag: 'Clubhouse & Games',
    title: 'Wii Bowling Championship Thursday at 3 PM',
    content:
      'Looking for 2 more players to round out our team for this week’s friendly match in Magnolia Lounge. Beginners welcome!',
    likes: 5,
    liked: false,
    comments: [],
  },
];

const INITIAL_MARKET_ITEMS: MarketItem[] = [
  {
    id: 'market-1',
    title: 'Cuisinart 4-Slice Toaster (Stainless Steel)',
    price: '$15',
    description:
      'Works perfectly, very clean. Downsized recently and no longer need a 4-slice model. Porch pickup at Apt 208.',
    author: 'Eleanor Vance',
    unit: 'Bldg 2 • Apt 204',
    timeAgo: '3h ago',
    isOwner: false,
    claimed: false,
    sold: false,
  },
  {
    id: 'market-2',
    title: 'Hardcover Large Print Mystery Novels (Set of 6)',
    price: 'FREE',
    description:
      'Great collection of Agatha Christie & modern cozy mysteries in clean condition. Free to good home!',
    author: 'Margaret Higgins',
    unit: 'Bldg 3 • Apt 301',
    timeAgo: '1d ago',
    isOwner: false,
    claimed: false,
    sold: false,
  },
];

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
  toggleLike: (id: number | string) => void;
  openCommentsPostId: number | string | null;
  setOpenCommentsPostId: React.Dispatch<React.SetStateAction<number | string | null>>;
  commentInputText: { [postId: string]: string };
  setCommentInputText: React.Dispatch<React.SetStateAction<{ [postId: string]: string }>>;
  handleAddComment: (postId: number | string) => void;
  handleModalAddComment: (targetId: number | string, text: string) => void;
  isItemCreator: (item?: PostItem | MarketItem | null) => boolean;
  handleDeleteItem: (id: number | string, isMarket?: boolean) => void;
  handleToggleSoldItem: (id: number | string) => void;
  handleOpenMessageSeller: (item: MarketItem) => void;
  handleSendMessageToSeller: (
    itemOrRecipient: MarketItem | string,
    messageText?: string
  ) => Promise<void> | void;
  handleCreatePostSubmit: (payload: {
    type: 'chat' | 'market';
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
  const [posts, setPosts] = useState<PostItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_POSTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse cached posts:', e);
    }
    return INITIAL_POSTS;
  });

  const [marketItems, setMarketItems] = useState<MarketItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MARKET_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse cached marketplace items:', e);
    }
    return INITIAL_MARKET_ITEMS;
  });

  const [socialView, setSocialView] = useState<'chat' | 'market'>('chat');
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [selectedDetailPost, setSelectedDetailPost] = useState<PostItem | null>(null);
  const [selectedDetailMarket, setSelectedDetailMarket] = useState<MarketItem | null>(null);
  const [selectedMessageSellerItem, setSelectedMessageSellerItem] = useState<MarketItem | null>(
    null
  );
  const [isMessageSellerModalOpen, setIsMessageSellerModalOpen] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<{
    media: MediaAttachment[];
    initialIndex?: number;
    title?: string;
    author?: string;
  } | null>(null);

  const [openCommentsPostId, setOpenCommentsPostId] = useState<number | string | null>(null);
  const [commentInputText, setCommentInputText] = useState<{ [postId: string]: string }>({});

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(posts));
    } catch (e) {
      console.warn('Failed to persist discussion posts:', e);
    }
  }, [posts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MARKET_KEY, JSON.stringify(marketItems));
    } catch (e) {
      console.warn('Failed to persist marketplace items:', e);
    }
  }, [marketItems]);

  // Firestore live subscriptions
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    try {
      const qPosts = query(collection(db, 'discussion_feed'), orderBy('createdAt', 'desc'));
      const unsubPosts = onSnapshot(
        qPosts,
        (snapshot) => {
          if (!snapshot.empty) {
            const remotePosts: PostItem[] = snapshot.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                author: d.author || 'Resident',
                authorAvatar: d.authorAvatar || '',
                authorId: d.userId,
                authorEmail: d.authorEmail || '',
                unit: d.unit || 'TownLoop Resident',
                timeAgo: d.timeAgo || 'Recent',
                tag: d.tag || 'Community',
                title: d.title || 'Community Post',
                content: d.content || '',
                mediaUrl: d.mediaUrl,
                media: d.media || (d.mediaUrl ? [{ type: 'image', url: d.mediaUrl }] : []),
                likes: d.likes || 0,
                liked: false,
                comments: d.comments || [],
              };
            });
            setPosts(remotePosts);
          }
        },
        (err) => console.warn('Firestore discussion listener error:', err)
      );

      const qMarket = query(collection(db, 'marketplace_posts'), orderBy('createdAt', 'desc'));
      const unsubMarket = onSnapshot(
        qMarket,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteMarket: MarketItem[] = snapshot.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                title: d.title || 'Market Item',
                price: d.price || 'FREE',
                description: d.description || '',
                author: d.author || 'Resident',
                authorAvatar: d.authorAvatar || '',
                authorId: d.userId,
                authorEmail: d.authorEmail || '',
                unit: d.unit || 'TownLoop Resident',
                timeAgo: d.timeAgo || 'Recent',
                isOwner: String(d.userId) === String(currentUser?.id),
                claimed: Boolean(d.claimed || d.sold),
                sold: Boolean(d.sold || d.claimed),
                mediaUrl: d.mediaUrl,
                photoUrl: d.mediaUrl,
                media: d.media || (d.mediaUrl ? [{ type: 'image', url: d.mediaUrl }] : []),
                comments: d.comments || [],
              };
            });
            setMarketItems(remoteMarket);
          }
        },
        (err) => console.warn('Firestore marketplace listener error:', err)
      );

      return () => {
        unsubPosts();
        unsubMarket();
      };
    } catch (err) {
      console.warn('Failed to attach Firestore community listeners:', err);
    }
  }, [currentUser?.id]);

  const toggleLike = useCallback((id: number | string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (String(p.id) === String(id)) {
          const nextLiked = !p.liked;
          const nextLikes = nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1);
          return { ...p, liked: nextLiked, likes: nextLikes };
        }
        return p;
      })
    );
  }, []);

  const handleAddComment = useCallback(
    (postId: number | string) => {
      const text = (commentInputText[String(postId)] || '').trim();
      if (!text) return;

      const newComment: CommentItem = {
        id: `c-${Date.now()}`,
        author: currentUser?.name || 'Resident',
        unit: currentUser?.address || currentUser?.apartmentNumber || 'Unit 208',
        text,
        timeAgo: 'Just now',
      };

      setPosts((prev) =>
        prev.map((p) =>
          String(p.id) === String(postId)
            ? { ...p, comments: [...(p.comments || []), newComment] }
            : p
        )
      );

      setCommentInputText((prev) => ({ ...prev, [String(postId)]: '' }));
      showToast?.('Comment posted!');
    },
    [commentInputText, currentUser, showToast]
  );

  const handleModalAddComment = useCallback(
    (targetId: number | string, text: string) => {
      if (!text.trim()) return;

      const newComment: CommentItem = {
        id: `c-${Date.now()}`,
        author: currentUser?.name || 'Resident',
        unit: currentUser?.address || currentUser?.apartmentNumber || 'Unit 208',
        text: text.trim(),
        timeAgo: 'Just now',
      };

      if (selectedDetailPost && String(selectedDetailPost.id) === String(targetId)) {
        const updatedPost = {
          ...selectedDetailPost,
          comments: [...(selectedDetailPost.comments || []), newComment],
        };
        setSelectedDetailPost(updatedPost);
        setPosts((prev) =>
          prev.map((p) => (String(p.id) === String(targetId) ? updatedPost : p))
        );
      }

      if (selectedDetailMarket && String(selectedDetailMarket.id) === String(targetId)) {
        const updatedMarket = {
          ...selectedDetailMarket,
          comments: [...(selectedDetailMarket.comments || []), newComment],
        };
        setSelectedDetailMarket(updatedMarket);
        setMarketItems((prev) =>
          prev.map((m) => (String(m.id) === String(targetId) ? updatedMarket : m))
        );
      }

      showToast?.('Comment posted!');
    },
    [currentUser, selectedDetailPost, selectedDetailMarket, showToast]
  );

  const isItemCreator = useCallback(
    (item?: PostItem | MarketItem | null): boolean => {
      if (!item || !currentUser) return false;
      if (item.authorId && String(item.authorId) === String(currentUser.id)) return true;
      if (item.author && item.author === currentUser.name) return true;
      return false;
    },
    [currentUser]
  );

  const handleDeleteItem = useCallback(
    (id: number | string, _isMarket?: boolean) => {
      setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
      setMarketItems((prev) => prev.filter((m) => String(m.id) !== String(id)));
      if (selectedDetailPost && String(selectedDetailPost.id) === String(id)) {
        setSelectedDetailPost(null);
      }
      if (selectedDetailMarket && String(selectedDetailMarket.id) === String(id)) {
        setSelectedDetailMarket(null);
      }
      deleteDiscussionFeedPostFromFirestore(id);
      deleteMarketplacePostFromFirestore(id);
      showToast?.('Item deleted');
    },
    [selectedDetailPost, selectedDetailMarket, showToast]
  );

  const handleToggleSoldItem = useCallback(
    (id: number | string) => {
      setMarketItems((prev) =>
        prev.map((item) => {
          if (String(item.id) === String(id)) {
            const nextSold = !item.sold;
            const updated = { ...item, sold: nextSold, claimed: nextSold };
            if (selectedDetailMarket && String(selectedDetailMarket.id) === String(id)) {
              setSelectedDetailMarket(updated);
            }
            updateFirestoreDocument('marketplace_posts', id, { sold: nextSold, claimed: nextSold });
            return updated;
          }
          return item;
        })
      );
      showToast?.('Listing status updated');
    },
    [selectedDetailMarket, showToast]
  );

  const handleOpenMessageSeller = useCallback((item: MarketItem) => {
    setSelectedMessageSellerItem(item);
    setIsMessageSellerModalOpen(true);
  }, []);

  const handleSendMessageToSeller = useCallback(
    async (itemOrRecipient: MarketItem | string, messageText?: string) => {
      setIsMessageSellerModalOpen(false);
      setSelectedMessageSellerItem(null);
      showToast?.('Message sent to seller!');
    },
    [showToast]
  );

  const handleCreatePostSubmit = useCallback(
    async (payload: {
      type: 'chat' | 'market';
      title: string;
      description: string;
      price?: string;
      media: MediaAttachment[];
      mediaUrl?: string;
    }) => {
      const author = currentUser?.name || 'Resident';
      const unit = currentUser?.address || currentUser?.apartmentNumber || 'Unit 208';
      const authorId = currentUser?.id || 'resident';
      const authorEmail = currentUser?.email || '';

      if (payload.type === 'chat') {
        const tempId = `post-${Date.now()}`;
        const newPost: PostItem = {
          id: tempId,
          author,
          authorId,
          authorEmail,
          unit,
          timeAgo: 'Just now',
          tag: 'General',
          title: payload.title || payload.description.slice(0, 35) || 'Community Post',
          content: payload.description,
          media: payload.media,
          mediaUrl: payload.mediaUrl || (payload.media.length > 0 ? payload.media[0].url : undefined),
          likes: 0,
          liked: false,
          comments: [],
        };

        setPosts((prev) => [newPost, ...prev]);
        setIsCreatePostModalOpen(false);

        try {
          const fid = await saveDiscussionFeedPostToFirestore({
            content: newPost.content,
            title: newPost.title,
            mediaUrl: newPost.mediaUrl || '',
            userId: String(authorId),
            author,
            authorEmail,
            unit,
          });
          if (fid) {
            setPosts((prev) =>
              prev.map((p) => (p.id === tempId ? { ...p, id: fid } : p))
            );
          }
        } catch (err) {
          console.warn('Failed to save post to Firestore:', err);
        }
        showToast?.('Community post shared!');
      } else {
        const tempId = `market-${Date.now()}`;
        const newMarketItem: MarketItem = {
          id: tempId,
          title: payload.title,
          price: payload.price || 'FREE',
          description: payload.description,
          author,
          authorId,
          authorEmail,
          unit,
          timeAgo: 'Just now',
          isOwner: true,
          claimed: false,
          sold: false,
          media: payload.media,
          mediaUrl: payload.mediaUrl || (payload.media.length > 0 ? payload.media[0].url : undefined),
          photoUrl: payload.mediaUrl || (payload.media.length > 0 ? payload.media[0].url : undefined),
        };

        setMarketItems((prev) => [newMarketItem, ...prev]);
        setIsCreatePostModalOpen(false);

        try {
          const fid = await saveMarketplacePostToFirestore({
            title: newMarketItem.title,
            description: newMarketItem.description,
            price: newMarketItem.price,
            mediaUrl: newMarketItem.mediaUrl || '',
            userId: String(authorId),
            author,
            authorEmail,
            unit,
          });
          if (fid) {
            setMarketItems((prev) =>
              prev.map((m) => (m.id === tempId ? { ...m, id: fid } : m))
            );
          }
        } catch (err) {
          console.warn('Failed to save marketplace post to Firestore:', err);
        }
        showToast?.('Marketplace listing created!');
      }
    },
    [currentUser, showToast]
  );

  return {
    currentUser,
    posts,
    setPosts,
    marketItems,
    setMarketItems,
    socialView,
    setSocialView,
    isCreatePostModalOpen,
    setIsCreatePostModalOpen,
    selectedDetailPost,
    setSelectedDetailPost,
    selectedDetailMarket,
    setSelectedDetailMarket,
    selectedMessageSellerItem,
    setSelectedMessageSellerItem,
    isMessageSellerModalOpen,
    setIsMessageSellerModalOpen,
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
