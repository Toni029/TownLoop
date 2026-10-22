import { editableResolution, resolutionPatch, removeResolutionComment } from "../data/workOrderResolution";
import { getUserRole } from "../utils/permissions";
import { mutateSocial, type SocialCollection } from "./socialIntegrity";
import { allocateWorkOrder } from "../data/allocateWorkOrder";
/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import {
  collection,
  runTransaction,
  deleteField,
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
  Timestamp,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { PostItem, MarketItem, WorkOrderItem, WorkOrderComment, UserProfile, CommunityRsvpEvent, PinnedHighlight, NewsletterConfig, MediaAttachment } from '../types';

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

type SocialParams = {
  id?: string; title?: string; mediaUrl: string; media?: MediaAttachment[];
  userId: string; author?: string; authorAvatar?: string; authorEmail?: string; unit?: string;
  comments?: any[];
};
export interface SaveMarketplacePostParams extends SocialParams {
  title: string; description: string; price: string; sold?: boolean; claimed?: boolean;
}
export interface SaveDiscussionFeedParams extends SocialParams {
  content: string; tag?: string; likes?: number;
}
async function saveSocialDocument(name: 'discussion_feed' | 'marketplace_posts', params: SaveDiscussionFeedParams | SaveMarketplacePostParams): Promise<string> {
  const uid = auth?.currentUser?.uid;
  if (!isFirebaseConfigured() || !db || !uid) throw Error('Please sign in before publishing.');
  const reference = params.id ? doc(db, name, params.id) : doc(collection(db, name));
  await runTransaction(db, async transaction => {
    const [profileSnapshot, existing] = await Promise.all([
      transaction.get(doc(db, 'users', uid)), transaction.get(reference),
    ]);
    const profile = profileSnapshot.data();
    if (auth?.currentUser?.uid !== uid || !profile || profile.approved !== true || profile.deletionPending === true || !['resident', 'admin', 'vip', 'crew'].includes(profile.role))
      throw Error('An approved account is required.');
    const content = name === 'discussion_feed' ? {
      content: (params as SaveDiscussionFeedParams).content.trim(),
      tag: (params as SaveDiscussionFeedParams).tag || 'Community',
    } : {
      description: (params as SaveMarketplacePostParams).description.trim(),
      price: (params as SaveMarketplacePostParams).price || 'FREE',
    };
    const editable = { ...content, title: params.title?.trim() || 'Community Post',
      media: params.media || [], mediaUrl: params.mediaUrl || '', updatedAt: serverTimestamp() };
    const before = existing.data();
    if (existing.exists() && before?.storageDraft !== true) {
      if (before?.storageDraft !== false) throw Error('This item needs a compatibility review.');
      if ((before.userId ?? before.authorId) !== uid && !['admin', 'vip'].includes(profile.role))
        throw Error('Only the author or office can edit this item.');
      transaction.update(reference, editable);
      return;
    }
    if (before && (before.userId !== uid || !(before.storageDraftExpiresAt instanceof Timestamp) || before.storageDraftExpiresAt.toMillis() <= Date.now()))
      throw Error('This upload draft expired or belongs to another account. Start a new form.');
    // Replace the hidden upload parent atomically; never expose a draft or retain its expiry fields.
    transaction.set(reference, { ...editable, userId: uid, storageDraft: false,
      author: profile.name || 'Resident', authorAvatar: profile.avatarUrl || profile.avatar_url || '',
      authorEmail: '', unit: 'TownLoop Resident', createdAt: serverTimestamp(), comments: [],
      ...(name === 'discussion_feed' ? { likes: 0, likedBy: {} } : { sold: false, claimed: false }),
    });
  });
  return reference.id;
}
export async function saveMarketplacePostToFirestore(params: SaveMarketplacePostParams): Promise<string | null> {
  return saveSocialDocument('marketplace_posts', params);
}
export async function saveDiscussionFeedPostToFirestore(params: SaveDiscussionFeedParams): Promise<string | null> {
  return saveSocialDocument('discussion_feed', params);
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

  const authenticatedUser = auth?.currentUser;
  if (!authenticatedUser || authenticatedUser.isAnonymous) throw new Error('Please sign in before submitting a work order.');
  if (params.userId && params.userId !== authenticatedUser.uid) throw new Error('Work order ownership does not match your account.');
  const finalUserId = authenticatedUser.uid;

  const docPayload = {
    storageDraft: false,
    description: params.description || '',
    status: params.status || 'Pending', // Default to 'Pending' as requested
    createdAt: serverTimestamp(),
    userId: finalUserId,
    photoUrl: params.photoUrl || '',
    // Additional helpful metadata for portal UI
    code: params.code || "Assigning…",
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

  if (params.id != null) {
    const existing = await getDoc(doc(db, 'work_orders', String(params.id)));
    if (existing.exists()) {
      if (existing.data().userId !== finalUserId) throw new Error('This work order belongs to another account.');
      // A retried submission must never reset a published ticket's service state,
      // immutable owner/time, or reserved number. Drafts go through the allocator.
      if (existing.data().storageDraft !== true) return existing.id;
    }
  }
  const reference = params.id != null ? doc(db, 'work_orders', String(params.id)) : doc(collection(db, 'work_orders'));
  await allocateWorkOrder(db, reference, docPayload);
  return reference.id;
}

async function deleteSocialDocument(name: SocialCollection, id: string | number): Promise<boolean> {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return false;
  try { await mutateSocial(db, uid, name, String(id), 'delete'); return true; }
  catch (error) { console.warn('Could not delete social item:', error); return false; }
}

/**
 * Delete a post from marketplace_posts
 */
export async function deleteMarketplacePostFromFirestore(id: string | number): Promise<boolean> {
  return deleteSocialDocument('marketplace_posts', id);
}

/**
 * Delete a post from discussion_feed
 */
export async function deleteDiscussionFeedPostFromFirestore(id: string | number): Promise<boolean> {
  return deleteSocialDocument('discussion_feed', id);
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

  try {
    const uid = auth?.currentUser?.uid;
    if (!uid || crewUser && String(crewUser.id) !== uid) throw Error('Please sign in again.');
    const woDocRef = doc(db, 'work_orders', String(woId || woCode));
    const commentId = doc(collection(db, 'work_orders')).id;
    await runTransaction(db, async tx => {
      const [snapshot, actor] = await Promise.all([tx.get(woDocRef), tx.get(doc(db, 'users', uid))]);
      const user = {...actor.data(), id:uid} as UserProfile;
      if (getUserRole(user) !== 'crew' || !replyText.trim()) throw Error('A crew resolution note is required.');
      if (!snapshot.exists()) throw Error('Work order no longer exists.');
      const patch = resolutionPatch({...snapshot.data(),id:snapshot.id} as WorkOrderItem, user, {
        id:commentId,author:user.name,authorId:uid,role:'Maintenance Crew',text:replyText.trim(),timestamp:'Just now',photoUrl:photoDownloadUrl,
      },new Date().toISOString());
      if (patch) tx.update(woDocRef,{...patch,completedAt:serverTimestamp(),retentionVersion:1,updatedAt:serverTimestamp()});
    });
    return true;
  } catch { return false; }
}

export async function deleteWorkOrderResolutionComment(id: string | number, commentId: string): Promise<void> {
  if (!db || !auth?.currentUser) throw Error('Please sign in.');
  const uid = auth.currentUser.uid, ref = doc(db,'work_orders',String(id));
  await runTransaction(db,async tx=>{
    const [snapshot,actor]=await Promise.all([tx.get(ref),tx.get(doc(db!,'users',uid))]);
    if (!snapshot.exists()) throw Error('Work order no longer exists.');
    const before=snapshot.data(),patch=removeResolutionComment({...before,id:snapshot.id} as WorkOrderItem,{...actor.data(),id:uid} as UserProfile,commentId,new Date().toISOString());
    if(!patch)return;
    tx.update(ref,{comments:patch.comments,resolutionCommentDeletions:[...(before.resolutionCommentDeletions||[]),patch.audit],
      lastResolutionCommentDeletedAt:serverTimestamp(),updatedAt:serverTimestamp(),...(patch.activeIndex<0?
      {resolutionCommentId:deleteField(),resolutionCommentIndex:deleteField(),resolutionAuthorId:deleteField()}:{resolutionCommentIndex:patch.activeIndex})});
  });
}
export async function appendWorkOrderCrewNote(id: string | number, text: string, photoUrl = ''): Promise<void> {
  if(!db||!auth?.currentUser)throw Error('Please sign in.');
  const uid=auth.currentUser.uid,ref=doc(db,'work_orders',String(id)),commentId=doc(collection(db,'work_orders')).id;
  await runTransaction(db,async tx=>{
    const [snapshot,actor]=await Promise.all([tx.get(ref),tx.get(doc(db!,'users',uid))]);
    const user={...actor.data(),id:uid} as UserProfile;
    if(getUserRole(user)!=='crew'||!text.trim()||text.length>10000)throw Error('A crew note is required.');
    if(!snapshot.exists()||snapshot.data().status==='Done')throw Error('Reopen this order before adding a note.');
    tx.update(ref,{comments:[...(snapshot.data().comments||[]),{id:commentId,authorId:uid,author:user.name,role:'Maintenance Crew',text:text.trim(),timestamp:'Just now',photoUrl}],updatedAt:serverTimestamp()});
  });
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
    media: post.media || [],
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
    media: item.media || [],
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
          newsletterId: ev.newsletterId || null,
          editionMonth: ev.editionMonth || null,
          createdAt: ev.createdAt || Date.now(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
    console.log(`[Newsletter Pipeline] Firestore write completed: Saved ${events.length} RSVP events to community_events`);
    return true;
  } catch (err) {
    console.warn('[Firestore Sync] Unable to sync community RSVP events to Firestore:', err);
    return false;
  }
}

/**
 * Retrieve all community RSVP events from Firestore collection 'community_events'
 * Prioritizes newest records (ordered by creation timestamp descending) and filters out obsolete prior AI extractions.
 */
export async function getCommunityEventsFromFirestore(activeNewsletterId?: string): Promise<CommunityRsvpEvent[]> {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const coll = collection(db, 'community_events');
    const snap = await getDocs(coll);
    if (snap.empty) return [];
    const events: CommunityRsvpEvent[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const isAi = Boolean(data.isAiExtracted);
      const evNewsletterId = data.newsletterId ? String(data.newsletterId) : '';

      // If activeNewsletterId is provided, filter out stale AI-extracted events from old/prior editions
      if (isAi && activeNewsletterId && evNewsletterId && evNewsletterId !== activeNewsletterId) {
        return;
      }

      events.push({
        id: d.id,
        title: data.title || '',
        month: data.month || 'TBA',
        day: String(data.day || '1'),
        time: data.time || '',
        location: data.location || '',
        category: data.category || 'Special Event',
        attendeesCount: data.attendeesCount || (Array.isArray(data.attendees) ? data.attendees.length : 0),
        attendees: data.attendees || [],
        userRsvp: false,
        deadline: data.deadline || '',
        description: data.description || '',
        capacity: data.capacity ?? undefined,
        spotsLeft: data.spotsLeft ?? undefined,
        isAiExtracted: isAi,
        newsletterId: evNewsletterId || undefined,
        editionMonth: data.editionMonth || undefined,
        createdAt: data.createdAt || (data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now()),
      });
    });

    // Sort newest created events first
    events.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    console.log(
      `[Newsletter Pipeline] Firestore query completed: Retrieved ${events.length} active community RSVP events (filtered for active newsletter: ${activeNewsletterId || 'all'})`
    );
    return events;
  } catch (err) {
    console.warn('[Firestore Sync] Error fetching community RSVP events:', err);
    return [];
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
          newsletterId: h.newsletterId || null,
          editionMonth: h.editionMonth || null,
          createdAt: h.createdAt || Date.now(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
    console.log(`[Newsletter Pipeline] Firestore write completed: Saved ${highlights.length} pinned highlights to community_highlights`);
    return true;
  } catch (err) {
    console.warn('[Firestore Sync] Unable to sync pinned highlights to Firestore:', err);
    return false;
  }
}

/**
 * Retrieve all pinned highlights from Firestore collection 'community_highlights'
 * Prioritizes newest records (ordered by creation timestamp descending) and filters out obsolete prior AI extractions.
 */
export async function getCommunityHighlightsFromFirestore(activeNewsletterId?: string): Promise<PinnedHighlight[]> {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const coll = collection(db, 'community_highlights');
    const snap = await getDocs(coll);
    if (snap.empty) return [];
    const highlights: PinnedHighlight[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const isAi = Boolean(data.isAiExtracted);
      const hlNewsletterId = data.newsletterId ? String(data.newsletterId) : '';

      // If activeNewsletterId is provided, filter out stale AI-extracted highlights from old/prior editions
      if (isAi && activeNewsletterId && hlNewsletterId && hlNewsletterId !== activeNewsletterId) {
        return;
      }

      highlights.push({
        id: d.id,
        title: data.title || '',
        category: data.category || 'Community Notice',
        authorLabel: data.authorLabel || 'Community Update',
        description: data.description || '',
        date: data.date || '',
        tag: data.tag || '',
        summary: data.description || '',
        isAiExtracted: isAi,
        newsletterId: hlNewsletterId || undefined,
        editionMonth: data.editionMonth || undefined,
        createdAt: data.createdAt || (data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now()),
      });
    });

    // Sort newest created highlights first
    highlights.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    console.log(
      `[Newsletter Pipeline] Firestore query completed: Retrieved ${highlights.length} active pinned highlights (filtered for active newsletter: ${activeNewsletterId || 'all'})`
    );
    return highlights;
  } catch (err) {
    console.warn('[Firestore Sync] Error fetching pinned highlights:', err);
    return [];
  }
}

/**
 * Deletes obsolete auto-extracted events when a new newsletter edition is published
 */
export async function deleteOldAiEventsFromFirestore(currentNewsletterId?: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  try {
    const coll = collection(db, 'community_events');
    const snap = await getDocs(coll);
    if (snap.empty) return;
    const batch = writeBatch(db);
    let count = 0;
    snap.forEach((d) => {
      const data = d.data();
      if (data.isAiExtracted && currentNewsletterId && data.newsletterId && data.newsletterId !== currentNewsletterId) {
        batch.delete(d.ref);
        count++;
      } else if (data.isAiExtracted && !data.newsletterId && currentNewsletterId) {
        batch.delete(d.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
      console.log(`[Newsletter Pipeline] Cleaned up ${count} prior edition AI events from Firestore`);
    }
  } catch (err) {
    console.warn('[Firestore Sync] Error cleaning up old AI events:', err);
  }
}

/**
 * Deletes obsolete auto-extracted highlights when a new newsletter edition is published
 */
export async function deleteOldAiHighlightsFromFirestore(currentNewsletterId?: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  try {
    const coll = collection(db, 'community_highlights');
    const snap = await getDocs(coll);
    if (snap.empty) return;
    const batch = writeBatch(db);
    let count = 0;
    snap.forEach((d) => {
      const data = d.data();
      if (data.isAiExtracted && currentNewsletterId && data.newsletterId && data.newsletterId !== currentNewsletterId) {
        batch.delete(d.ref);
        count++;
      } else if (data.isAiExtracted && !data.newsletterId && currentNewsletterId) {
        batch.delete(d.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
      console.log(`[Newsletter Pipeline] Cleaned up ${count} prior edition AI highlights from Firestore`);
    }
  } catch (err) {
    console.warn('[Firestore Sync] Error cleaning up old AI highlights:', err);
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
    const active = await getDoc(doc(db, 'newsletters', 'current'));
    const activeConfig = active.exists() ? active.data() : null;
    if (!activeConfig || activeConfig.isRemoved || (newsletterId !== 'current' && activeConfig.id !== newsletterId)) return null;
    const metadata = await getDoc(doc(db, 'newsletters', newsletterId));
    const expectedChunks = metadata.data()?.totalChunks;
    if (!Number.isInteger(expectedChunks) || expectedChunks < 1) return null;
    const chunksColl = collection(db, 'newsletters', newsletterId, 'chunks');
    const snap = await getDocs(chunksColl);

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
    const currentChunks = chunkItems.filter((c) => c.index < expectedChunks);
    if (currentChunks.length !== expectedChunks || currentChunks.some((c, index) => c.index !== index)) return null;
    const assembledDataUrl = currentChunks.map((c) => c.data).join('');

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


  } catch (err) {
    throw new Error('Could not remove the newsletter from cloud storage. Please try again.');
  }
}



export async function reopenWorkOrderInFirestore(id: string | number) {
  if (!db || !auth?.currentUser) throw Error('Please sign in.');
  const uid=auth.currentUser.uid,reference=doc(db,'work_orders',String(id));
  await runTransaction(db,async tx=>{
    const [snapshot,actor]=await Promise.all([tx.get(reference),tx.get(doc(db!,'users',uid))]);
    const user={...actor.data(),id:uid} as UserProfile;
    if(getUserRole(user)!=='crew')throw Error('Only crew can reopen orders.');
    if(!snapshot.exists()||snapshot.data().status!=='Done')return;
    const order={...snapshot.data(),id:snapshot.id} as WorkOrderItem,previous=editableResolution(order,user);
    tx.update(reference,{...(previous?{resolutionCommentId:previous.id,resolutionCommentIndex:(order.comments||[]).findIndex(c=>c.id===previous.id),resolutionAuthorId:uid}:
      {resolutionCommentId:deleteField(),resolutionCommentIndex:deleteField(),resolutionAuthorId:deleteField()}),
      status:'In Progress',statusNote:'Reopened for maintenance inspection',completedAt:deleteField(),completedBy:deleteField(),retentionVersion:deleteField(),resolutionNote:deleteField(),updatedAt:serverTimestamp()});
  });
}
