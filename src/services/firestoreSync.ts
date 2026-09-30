/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { PostItem, MarketItem, WorkOrderItem, WorkOrderComment, UserProfile, CommunityRsvpEvent, PinnedHighlight, NewsletterConfig } from '../types';

type CollectionName = 'marketplace_posts' | 'discussion_feed' | 'work_orders' | 'community_events' | 'community_highlights';

export async function updateFirestoreDocument(
  name: CollectionName, id: string | number, changes: Record<string, any>
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    await updateDoc(doc(db, name, String(id)), { ...changes, updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.warn(`Unable to update ${name}:`, error);
    return false;
  }
}

async function saveDocument(
  name: CollectionName, params: { id?: string | number }, defaults: Record<string, any>
): Promise<string | null> {
  if (!isFirebaseConfigured() || !db) return null;
  if (params.id != null) {
    // Patches must never reset creation time or transfer ownership to the editor.
    const immutable = new Set(['id', 'createdAt', 'userId', 'userName', 'userEmail',
      'author', 'authorAvatar', 'authorEmail', 'unit']);
    const changes = Object.fromEntries(Object.entries(params)
      .filter(([key, value]) => !immutable.has(key) && value !== undefined));
    return await updateFirestoreDocument(name, params.id, changes) ? String(params.id) : null;
  }
  try {
    return (await addDoc(collection(db, name), defaults)).id;
  } catch (error) {
    console.warn(`Unable to create ${name}:`, error);
    return null;
  }
}

async function deleteDocument(name: CollectionName, id: string | number): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    await deleteDoc(doc(db, name, String(id)));
    return true;
  } catch (error) {
    console.warn(`Unable to delete from ${name}:`, error);
    return false;
  }
}

/**
 * Requirement 1: Marketplace
 * When getDownloadURL() returns the link, save a document to a Firestore collection
 * named marketplace_posts containing: title, description, price, createdAt, userId, and mediaUrl.
 */
export interface SaveMarketplacePostParams {
  title: string;
  description: string;
  price: string;
  mediaUrl: string;
  userId: string;
  id?: string;
  author?: string;
  authorAvatar?: string;
  authorEmail?: string;
  unit?: string;
  sold?: boolean;
  claimed?: boolean;
  comments?: any[];
}

export async function saveMarketplacePostToFirestore(
  params: SaveMarketplacePostParams
): Promise<string | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  const docPayload = {
    title: params.title || 'Marketplace Item',
    description: params.description || '',
    price: params.price || 'FREE',
    createdAt: serverTimestamp(),
    userId: params.userId || (auth?.currentUser?.uid ? String(auth.currentUser.uid) : 'resident'),
    mediaUrl: params.mediaUrl || '',
    // Contextual metadata for rich UI display
    author: params.author || 'Resident',
    authorAvatar: params.authorAvatar || '',
    authorEmail: params.authorEmail || '',
    unit: params.unit || 'TownLoop Resident',
    sold: Boolean(params.sold || params.claimed),
    claimed: Boolean(params.claimed || params.sold),
    comments: params.comments || [],
  };

  return saveDocument('marketplace_posts', params, docPayload);
}

/**
 * Requirement 2: Discussion Feed
 * Save a document to a Firestore collection named discussion_feed containing:
 * content, createdAt, userId, and mediaUrl.
 */
export interface SaveDiscussionFeedParams {
  content: string;
  mediaUrl: string;
  userId: string;
  id?: string;
  title?: string;
  author?: string;
  authorAvatar?: string;
  authorEmail?: string;
  unit?: string;
  tag?: string;
  likes?: number;
  comments?: any[];
}

export async function saveDiscussionFeedPostToFirestore(
  params: SaveDiscussionFeedParams
): Promise<string | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  const docPayload = {
    content: params.content || '',
    createdAt: serverTimestamp(),
    userId: params.userId || (auth?.currentUser?.uid ? String(auth.currentUser.uid) : 'resident'),
    mediaUrl: params.mediaUrl || '',
    // Contextual metadata for rich UI display
    title: params.title || (params.content ? params.content.slice(0, 45) : 'Community Post'),
    author: params.author || 'Resident',
    authorAvatar: params.authorAvatar || '',
    authorEmail: params.authorEmail || '',
    unit: params.unit || 'TownLoop Resident',
    tag: params.tag || 'Community',
    likes: params.likes || 0,
    comments: params.comments || [],
  };

  return saveDocument('discussion_feed', params, docPayload);
}

/**
 * Requirement 3: Work Orders
 * Save a document to a Firestore collection named work_orders containing:
 * description, status (default to 'Pending'), createdAt, userId, and photoUrl.
 */
export interface SaveWorkOrderParams {
  description: string;
  status?: 'Pending' | 'In Progress' | 'Queued' | 'Submitted' | 'Done';
  photoUrl: string;
  userId: string;
  id?: string | number;
  code?: string;
  title?: string;
  category?: string;
  categoryEmoji?: string;
  unit?: string;
  placeInLine?: number;
  aheadCount?: number;
  statusNote?: string;
  photos?: string[];
  comments?: WorkOrderComment[];
  userName?: string;
  userEmail?: string;
}

export async function saveWorkOrderToFirestore(
  params: SaveWorkOrderParams,
  currentUser?: UserProfile | null
): Promise<string | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  const finalUserId = params.userId || currentUser?.id
    ? String(params.userId || currentUser?.id)
    : (auth?.currentUser?.uid ? String(auth.currentUser.uid) : 'resident');

  const docPayload = {
    description: params.description || '',
    status: params.status || 'Pending', // Default to 'Pending' as requested
    createdAt: serverTimestamp(),
    userId: finalUserId,
    photoUrl: params.photoUrl || '',
    // Additional helpful metadata for portal UI
    code: params.code || `WO-${Math.floor(1000 + Math.random() * 9000)}`,
    title: params.title || (params.description ? params.description.slice(0, 35) : 'Work Order Request'),
    category: params.category || 'General Maintenance',
    categoryEmoji: params.categoryEmoji || '🛠️',
    unit: params.unit || currentUser?.address || 'Unit 208',
    placeInLine: params.placeInLine ?? 1,
    aheadCount: params.aheadCount ?? 0,
    statusNote: params.statusNote || 'Pending maintenance review',
    photos: params.photos || (params.photoUrl ? [params.photoUrl] : []),
    comments: params.comments || [],
    userName: currentUser?.name || auth?.currentUser?.displayName || 'Resident',
    userEmail: currentUser?.email || auth?.currentUser?.email || '',
  };

  return saveDocument('work_orders', params, docPayload);
}

/**
 * Delete a post from marketplace_posts
 */
export async function deleteMarketplacePostFromFirestore(id: string | number): Promise<boolean> {
  return deleteDocument('marketplace_posts', id);
}

/**
 * Delete a post from discussion_feed
 */
export async function deleteDiscussionFeedPostFromFirestore(id: string | number): Promise<boolean> {
  return deleteDocument('discussion_feed', id);
}

/**
 * Delete a work order from work_orders
 */
export async function deleteWorkOrderFromFirestore(id: string | number): Promise<boolean> {
  return deleteDocument('work_orders', id);
}

/**
 * Delete an RSVP event from community_events
 */
export async function deleteRsvpEventFromFirestore(id: string | number): Promise<boolean> {
  return deleteDocument('community_events', id);
}

/**
 * Delete a pinned highlight from community_highlights
 */
export async function deletePinnedHighlightFromFirestore(id: string | number): Promise<boolean> {
  return deleteDocument('community_highlights', id);
}

/**
 * Save crew resolution reply + photo to work order
 */
export async function saveWorkOrderResolutionToFirestore({
  woId,
  woCode,
  replyText,
  photoDownloadUrl,
  crewUser,
}: {
  woId: number | string;
  woCode?: string;
  replyText: string;
  photoDownloadUrl: string;
  crewUser?: UserProfile | null;
}): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) {
    return false;
  }

  const resolutionComment: WorkOrderComment = {
    id: crypto.randomUUID(),
    author: crewUser?.name || 'Maintenance Crew',
    role: 'Maintenance Crew',
    text: replyText.trim(),
    timestamp: 'Just now',
    photoUrl: photoDownloadUrl,
  };

  try {
    const woDocRef = doc(db, 'work_orders', String(woId || woCode));
    await updateDoc(
      woDocRef,
      {
        status: 'Done',
        statusNote: `Completed by ${crewUser?.name || 'Maintenance Crew'}`,
        completedAt: new Date().toISOString(),
        completedBy: crewUser?.name || 'Maintenance Crew',
        photoUrl: photoDownloadUrl,
        latestResolutionPhoto: photoDownloadUrl,
        comments: arrayUnion(resolutionComment),
        updatedAt: serverTimestamp(),
      }
    );
    return true;
  } catch (error) {
    console.warn('Notice: Updating work order resolution in Firestore:', error);
    return false;
  }
}

// Backward compatibility wrappers
export async function savePostToFirestore(
  post: Omit<PostItem, 'id'> & { id?: number | string }
): Promise<string | null> {
  const firstMediaUrl = post.media && post.media.length > 0 ? post.media[0].url : (post.mediaUrl || '');
  return saveDiscussionFeedPostToFirestore({
    id: post.id ? String(post.id) : undefined,
    title: post.title,
    content: post.content,
    mediaUrl: firstMediaUrl,
    userId: String(post.authorId || ''),
    author: post.author,
    authorAvatar: post.authorAvatar,
    authorEmail: post.authorEmail,
    unit: post.unit,
    tag: post.tag,
    likes: post.likes,
    comments: post.comments,
  });
}

export async function saveMarketItemToFirestore(
  item: Omit<MarketItem, 'id'> & { id?: number | string }
): Promise<string | null> {
  const firstMediaUrl = item.media && item.media.length > 0 ? item.media[0].url : (item.mediaUrl || item.photoUrl || '');
  return saveMarketplacePostToFirestore({
    id: item.id ? String(item.id) : undefined,
    title: item.title,
    description: item.description,
    price: item.price,
    mediaUrl: firstMediaUrl,
    userId: String(item.authorId || ''),
    author: item.author,
    authorAvatar: item.authorAvatar,
    authorEmail: item.authorEmail,
    unit: item.unit,
    sold: item.sold,
    claimed: item.claimed,
    comments: item.comments,
  });
}

/**
 * One-time Database Purge / Reset Utility
 * Wipes seeded mock documents from marketplace_posts, discussion_feed, and work_orders collections in Firestore.
 */
export async function purgeFirestoreMockData(): Promise<{
  success: boolean;
  deletedCounts: {
    marketplace: number;
    discussions: number;
    workOrders: number;
  };
  error?: string;
}> {
  return {
    success: false,
    deletedCounts: { marketplace: 0, discussions: 0, workOrders: 0 },
    error: 'Mock cleanup requires an explicit allowlist of verified mock document IDs.',
  };
}

/**
 * Persist community RSVP events to Firestore collection 'community_events'
 */
export async function saveRsvpEventsToFirestore(
  events: CommunityRsvpEvent[]
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const batch = writeBatch(db);
    for (const ev of events) {
      const docRef = doc(db, 'community_events', String(ev.id));
      batch.set(
        docRef,
        {
          title: ev.title,
          month: ev.month,
          day: ev.day,
          time: ev.time,
          location: ev.location,
          category: ev.category,
          attendeesCount: ev.attendeesCount || 0,
          attendees: ev.attendees || [],
          description: ev.description,
          spotsLeft: ev.spotsLeft ?? null,
          capacity: ev.capacity ?? null,
          isAiExtracted: !!ev.isAiExtracted,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Unable to sync community RSVP events to Firestore:', err);
    return false;
  }
}

/**
 * Persist pinned highlights to Firestore collection 'community_highlights'
 */
export async function savePinnedHighlightsToFirestore(
  highlights: PinnedHighlight[]
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const batch = writeBatch(db);
    for (const h of highlights) {
      const docRef = doc(db, 'community_highlights', String(h.id));
      batch.set(
        docRef,
        {
          title: h.title,
          category: h.category,
          authorLabel: h.authorLabel,
          description: h.description,
          date: h.date || null,
          tag: h.tag || null,
          isAiExtracted: !!h.isAiExtracted,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Unable to sync pinned highlights to Firestore:', err);
    return false;
  }
}

/**
 * Persist newsletter edition configuration and page images array to Firestore 'newsletters' collection
 */
export async function saveNewsletterConfigToFirestore(
  config: NewsletterConfig
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const docId = config.id || 'current_newsletter';
    const docRef = doc(db, 'newsletters', docId);
    const pdfUrl = config.pdfUrl || config.fileUrl || '';
    await setDoc(
      docRef,
      {
        id: config.id,
        editionTitle: config.editionTitle || 'The Breeze',
        monthEdition: config.monthEdition || '',
        description: config.description || '',
        pdfUrl: pdfUrl,
        fileUrl: pdfUrl,
        fileName: config.fileName || '',
        fileType: config.fileType || 'application/pdf',
        fileSize: config.fileSize || '',
        pageImages: config.pageImages || [],
        uploadedAt: config.uploadedAt || Date.now(),
        uploadedBy: config.uploadedBy || 'Admin',
        isCustomUpload: !!config.isCustomUpload,
        isRemoved: !!config.isRemoved,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Also update current active edition pointer
    const currentRef = doc(db, 'newsletters', 'current');
    await setDoc(
      currentRef,
      {
        id: config.id,
        editionTitle: config.editionTitle || 'The Breeze',
        monthEdition: config.monthEdition || '',
        description: config.description || '',
        pdfUrl: pdfUrl,
        fileUrl: pdfUrl,
        fileName: config.fileName || '',
        fileType: config.fileType || 'application/pdf',
        fileSize: config.fileSize || '',
        pageImages: config.pageImages || [],
        uploadedAt: config.uploadedAt || Date.now(),
        uploadedBy: config.uploadedBy || 'Admin',
        isCustomUpload: !!config.isCustomUpload,
        isRemoved: !!config.isRemoved,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Unable to sync newsletter config to Firestore:', err);
    return false;
  }
}

/**
 * Retrieve the current active newsletter config from Firestore
 */
export async function getNewsletterConfigFromFirestore(): Promise<NewsletterConfig | null> {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const currentRef = doc(db, 'newsletters', 'current');
    const snap = await getDoc(currentRef);
    if (snap.exists()) {
      return snap.data() as NewsletterConfig;
    }
    return null;
  } catch (err) {
    console.warn('Unable to fetch newsletter config from Firestore:', err);
    return null;
  }
}

/**
 * Permanently stores raw PDF binary data in Cloud Firestore by chunking it into subcollection documents.
 * Chunks are sized at ~650 KB to stay well below Firestore's 1 MB per document quota.
 */
export async function saveNewsletterPdfChunksToFirestore(
  newsletterId: string,
  pdfDataUrl: string,
  onProgress?: (pct: number) => void
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db || !pdfDataUrl) return false;
  try {
    const CHUNK_SIZE = 650 * 1024;
    const totalLength = pdfDataUrl.length;
    const totalChunks = Math.max(1, Math.ceil(totalLength / CHUNK_SIZE));

    for (let i = 0; i < totalChunks; i++) {
      const chunkStr = pdfDataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkData = {
        index: i,
        data: chunkStr,
        totalChunks,
        chunkSize: chunkStr.length,
        totalSize: totalLength,
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(db, 'newsletters', newsletterId, 'chunks', String(i));
      const currentDocRef = doc(db, 'newsletters', 'current', 'chunks', String(i));

      await setDoc(docRef, chunkData);
      await setDoc(currentDocRef, chunkData);

      onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
    }

    // Flag document as containing a persistent Cloud Firestore binary blob
    const meta = {
      hasFirestoreBlob: true,
      totalChunks,
      totalSize: totalLength,
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'newsletters', newsletterId), meta, { merge: true });
    await setDoc(doc(db, 'newsletters', 'current'), meta, { merge: true });

    return true;
  } catch (err) {
    console.warn('Failed to save newsletter PDF chunks into Firestore storage:', err);
    return false;
  }
}

/**
 * Reassembles and downloads full PDF Data URL directly from Cloud Firestore subcollection chunks
 */
export async function getNewsletterPdfFromFirestore(
  newsletterId: string = 'current'
): Promise<string | null> {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const chunksColl = collection(db, 'newsletters', newsletterId, 'chunks');
    const snap = await getDocs(chunksColl);

    if (snap.empty && newsletterId !== 'current') {
      return getNewsletterPdfFromFirestore('current');
    }

    if (snap.empty) return null;

    const chunkItems: { index: number; data: string }[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (typeof data.data === 'string' && typeof data.index === 'number') {
        chunkItems.push({ index: data.index, data: data.data });
      }
    });

    if (chunkItems.length === 0) return null;

    chunkItems.sort((a, b) => a.index - b.index);
    const assembledDataUrl = chunkItems.map((c) => c.data).join('');

    return assembledDataUrl;
  } catch (err) {
    console.warn('Failed to retrieve newsletter PDF chunks from Firestore:', err);
    return null;
  }
}

/**
 * Deletes newsletter PDF subcollection chunks from Cloud Firestore
 */
export async function deleteNewsletterPdfChunksFromFirestore(
  newsletterId: string = 'current'
): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  try {
    const chunksColl = collection(db, 'newsletters', newsletterId, 'chunks');
    const snap = await getDocs(chunksColl);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    if (newsletterId !== 'current') {
      const currentChunksColl = collection(db, 'newsletters', 'current', 'chunks');
      const currentSnap = await getDocs(currentChunksColl);
      const currentBatch = writeBatch(db);
      currentSnap.forEach((d) => currentBatch.delete(d.ref));
      await currentBatch.commit();
    }
  } catch (err) {
    console.warn('Failed to delete newsletter PDF chunks from Firestore:', err);
  }
}


