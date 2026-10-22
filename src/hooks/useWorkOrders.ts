import { reopenWorkOrderInFirestore } from '../services/firestoreSync';
import { displayWorkOrderCode } from '../data/workOrderNumber';
import { canViewAllWorkOrders } from "../utils/permissions";
import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { WorkOrderItem, WorkOrderComment, UserProfile } from '../types';
import { getCategoryEmoji, WORK_ORDER_CATEGORIES } from '../data/workOrderCategories';
import {
  saveWorkOrderToFirestore,
  deleteWorkOrderFromFirestore,
  saveWorkOrderResolutionToFirestore,
  updateFirestoreDocument,
  appendWorkOrderCrewNote,
} from '../services/firestoreSync';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

const STORAGE_KEY = 'portal_work_orders_list';

const INITIAL_WORK_ORDERS: WorkOrderItem[] = [];

export interface WorkOrdersState {
  workOrders: WorkOrderItem[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrderItem[]>>;
  isLoading?: boolean;
  isWorkOrderModalOpen: boolean;
  setIsWorkOrderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newWoTitle: string;
  setNewWoTitle: React.Dispatch<React.SetStateAction<string>>;
  newWoDescription: string;
  setNewWoDescription: React.Dispatch<React.SetStateAction<string>>;
  newWoCategory: string;
  setNewWoCategory: React.Dispatch<React.SetStateAction<string>>;
  newWoPhotos: string[];
  setNewWoPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  handleWorkOrderSubmit: (e: React.FormEvent, recordId?: string) => Promise<void> | void;
  handleMarkAsDone: (id: number | string) => void;
  handleCompleteWithReply: (id: number | string, text: string, photoUrl?: string) => Promise<boolean>;
  handleReopenWorkOrder: (id: number | string) => void;
  handleDeleteWorkOrder: (id: number | string) => void;
  handleDeleteWorkOrderWithProof?: (id: number | string) => void;
  handleAddWorkOrderComment: (woId: number | string, text: string, photoUrl?: string) => Promise<boolean>;
  handleAddWorkOrderPhoto?: (woId: number | string, photoUrl: string) => void;
}

export function useWorkOrders(
  currentUser?: UserProfile | null,
  showToast?: (message: string) => void
): WorkOrdersState {
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>(() => {
    try {
      const userKey = currentUser?.id ? `portal_work_orders_${currentUser.id}` : null;
      const saved = (userKey && localStorage.getItem(userKey)) || localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((it) => it.id === 'wo-101' || it.id === 'wo-102')) {
          localStorage.removeItem(STORAGE_KEY);
          return [];
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse cached work orders:', e);
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState<boolean>(workOrders.length === 0);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [newWoTitle, setNewWoTitle] = useState('');
  const [newWoDescription, setNewWoDescription] = useState('');
  const [newWoCategory, setNewWoCategory] = useState(WORK_ORDER_CATEGORIES[0].name);
  const [newWoPhotos, setNewWoPhotos] = useState<string[]>([]);

  // Instant local cache restoration on login or user switch
  useEffect(() => {
    if (currentUser?.id) {
      try {
        const userKey = `portal_work_orders_${currentUser.id}`;
        const saved = localStorage.getItem(userKey) || localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWorkOrders(parsed);
            setIsLoading(false);
          }
        }
      } catch (e) {
        console.warn('Failed to restore user work orders from cache:', e);
      }
    }
  }, [currentUser?.id]);

  // Persist to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workOrders));
      if (currentUser?.id) {
        localStorage.setItem(`portal_work_orders_${currentUser.id}`, JSON.stringify(workOrders));
      }
    } catch (e) {
      console.warn('Failed to persist work orders:', e);
    }
  }, [workOrders, currentUser?.id]);

  // Firestore live subscription with strict error callbacks and lifecycle cleanup
  useEffect(() => {
    if (!isFirebaseConfigured() || !db || !currentUser || currentUser.approved === false) {
      setIsLoading(false);
      return;
    }
    let unsubscribe = () => {};
    try {
      const q = canViewAllWorkOrders(currentUser)
        ? query(collection(db, 'work_orders'), where('storageDraft', '==', false), orderBy('createdAt', 'desc'))
        : query(collection(db, 'work_orders'), where('storageDraft', '==', false), where('userId', '==', String(currentUser.id)));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const remoteOrders: WorkOrderItem[] = [...snapshot.docs].sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)).map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              code: displayWorkOrderCode(data.code || `WO-${doc.id.slice(-4)}`),
              title: data.title || 'Work Order',
              description: data.description || '',
              category: data.category || 'General Maintenance',
              categoryEmoji: data.categoryEmoji || getCategoryEmoji(data.category || ''),
              unit: data.unit || 'Resident Unit',
              placeInLine: data.placeInLine || 1,
              aheadCount: data.aheadCount || 0,
              status: data.status || 'Queued',
              statusNote: data.statusNote || 'Pending review',
              timeAgo: data.timeAgo || 'Recent',
              completedAt: typeof data.completedAt?.toDate === 'function' ? data.completedAt.toDate().toISOString() : data.completedAt,
              completedBy: data.completedBy,
              resolutionNote: data.resolutionNote, resolutionCommentId: data.resolutionCommentId,
              resolutionCommentIndex: data.resolutionCommentIndex, resolutionAuthorId: data.resolutionAuthorId,
              photoUrl: data.photoUrl,
              photos: data.photos || (data.photoUrl ? [data.photoUrl] : []),
              comments: data.comments || [],
              userId: data.userId,
              userEmail: data.userEmail,
              userName: data.userName,
            };
          });
          setWorkOrders(remoteOrders);
          setIsLoading(false);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteOrders));
            if (currentUser?.id) {
              localStorage.setItem(`portal_work_orders_${currentUser.id}`, JSON.stringify(remoteOrders));
            }
          } catch {}
        },
        (error) => {
          console.warn('Firestore work orders listener error:', error);
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.warn('Failed to attach Firestore work orders listener:', err);
      setIsLoading(false);
    }
    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.approved, currentUser?.role]);

  const handleWorkOrderSubmit = useCallback(
    async (e: React.FormEvent, recordId?: string) => {
      e.preventDefault();
      if (!newWoTitle.trim()) return;

      const code = 'Assigning…';
      const emoji = getCategoryEmoji(newWoCategory);
      const unit = currentUser?.address || currentUser?.apartmentNumber || 'Unit 208';

      const tempId = `wo-${Date.now()}`;
      const newOrder: WorkOrderItem = {
        id: tempId,
        code,
        title: newWoTitle.trim(),
        description: newWoDescription.trim(),
        category: newWoCategory,
        categoryEmoji: emoji,
        unit,
        placeInLine: workOrders.filter((w) => w.status !== 'Done').length + 1,
        aheadCount: workOrders.filter((w) => w.status !== 'Done').length,
        status: 'Queued',
        statusNote: 'Queued for maintenance technician',
        timeAgo: 'Just now',
        photos: [...newWoPhotos],
        photoUrl: newWoPhotos[0] || '',
        comments: [],
        userId: currentUser?.id || 'resident',
        userName: currentUser?.name || 'Resident',
        userEmail: currentUser?.email || '',
      };

      try {
        const firestoreId = await saveWorkOrderToFirestore(
          {
            id: recordId,
            title: newOrder.title,
            description: newOrder.description,
            category: newOrder.category,
            categoryEmoji: newOrder.categoryEmoji,
            unit: newOrder.unit,
            photoUrl: newOrder.photoUrl || '',
            photos: newOrder.photos,
            userId: String(newOrder.userId || ''),
            userName: newOrder.userName,
            userEmail: newOrder.userEmail,
            code: newOrder.code,
            status: 'Queued',
            statusNote: 'Queued for maintenance technician',
          },
          currentUser
        );
        if (!firestoreId) throw new Error('Work order could not be saved. Please try again.');
        setNewWoTitle('');
        setNewWoDescription('');
        setNewWoPhotos([]);
        setIsWorkOrderModalOpen(false);
        showToast?.('Work order request submitted!');
      } catch (err) {
        console.warn('Error syncing work order to Firestore:', err);
        showToast?.(err instanceof Error ? err.message : 'Work order was not saved. Please retry.');
        throw err;
      }

    },
    [newWoTitle, newWoDescription, newWoCategory, newWoPhotos, currentUser, workOrders, showToast]
  );

  const handleMarkAsDone = useCallback((_id: number | string) => {
    showToast?.('Enter a resolution note and submit your reply to complete this ticket.');
  }, [showToast]);

  const handleCompleteWithReply = useCallback(async (id: number | string, text: string, photoUrl?: string) => {
    if (currentUser?.role !== 'crew' || !text.trim()) {
      showToast?.('A crew resolution note is required.'); return false;
    }
    const saved = await saveWorkOrderResolutionToFirestore({ woId: id, replyText: text, photoDownloadUrl: photoUrl || '', crewUser: currentUser });
    showToast?.(saved ? 'Work order completed' : 'Work order was not completed. Please retry.');
    return saved;
  }, [currentUser, showToast]);

  const handleReopenWorkOrder = useCallback(async (id: number | string) => {
    try { await reopenWorkOrderInFirestore(id); showToast?.('Work order reopened'); }
    catch { showToast?.('Work order could not be reopened.'); }
  }, [showToast]);

  const handleDeleteWorkOrder = useCallback(async (id: number | string) => {
    const deleted = await deleteWorkOrderFromFirestore(id);
    showToast?.(deleted ? 'Work order deleted' : 'Work order could not be deleted.');
  }, [showToast]);

  const handleAddWorkOrderComment = useCallback(async (woId:number|string,text:string,photoUrl='') => {
    try {await appendWorkOrderCrewNote(woId,text,photoUrl);showToast?.('Crew note saved');return true;}
    catch {showToast?.('Crew note was not saved. Please retry.');return false;}
  },[showToast]);

  const handleAddWorkOrderPhoto = useCallback(
    (woId: number | string, photoUrl: string) => {
      if (!photoUrl) return;
      setWorkOrders((prev) =>
        prev.map((wo) =>
          String(wo.id) === String(woId)
            ? { ...wo, photos: [...(wo.photos || []), photoUrl] }
            : wo
        )
      );
      showToast?.('Photo added to work order');
    },
    [showToast]
  );

  return {
    workOrders,
    setWorkOrders,
    isWorkOrderModalOpen,
    setIsWorkOrderModalOpen,
    newWoTitle,
    setNewWoTitle,
    newWoDescription,
    setNewWoDescription,
    newWoCategory,
    setNewWoCategory,
    newWoPhotos,
    setNewWoPhotos,
    handleWorkOrderSubmit,
    handleMarkAsDone,
    handleCompleteWithReply,
    handleReopenWorkOrder,
    handleDeleteWorkOrder,
    handleDeleteWorkOrderWithProof: handleDeleteWorkOrder,
    handleAddWorkOrderComment,
    handleAddWorkOrderPhoto,
  };
}
