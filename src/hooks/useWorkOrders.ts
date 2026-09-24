import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { WorkOrderItem, WorkOrderComment, UserProfile } from '../types';
import { getCategoryEmoji, WORK_ORDER_CATEGORIES } from '../data/workOrderCategories';
import {
  saveWorkOrderToFirestore,
  deleteWorkOrderFromFirestore,
  saveWorkOrderResolutionToFirestore,
  updateFirestoreDocument,
} from '../services/firestoreSync';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

const STORAGE_KEY = 'portal_work_orders_list';

const INITIAL_WORK_ORDERS: WorkOrderItem[] = [];

export interface WorkOrdersState {
  workOrders: WorkOrderItem[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrderItem[]>>;
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
  handleWorkOrderSubmit: (e: React.FormEvent) => Promise<void> | void;
  handleMarkAsDone: (id: number | string) => void;
  handleCompleteWithReply: (id: number | string, text: string, photoUrl?: string) => void;
  handleReopenWorkOrder: (id: number | string) => void;
  handleDeleteWorkOrder: (id: number | string) => void;
  handleDeleteWorkOrderWithProof?: (id: number | string) => void;
  handleAddWorkOrderComment: (woId: number | string, text: string, photoUrl?: string) => void;
  handleAddWorkOrderPhoto?: (woId: number | string, photoUrl: string) => void;
}

export function useWorkOrders(
  currentUser?: UserProfile | null,
  showToast?: (message: string) => void
): WorkOrdersState {
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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

  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [newWoTitle, setNewWoTitle] = useState('');
  const [newWoDescription, setNewWoDescription] = useState('');
  const [newWoCategory, setNewWoCategory] = useState(WORK_ORDER_CATEGORIES[0].name);
  const [newWoPhotos, setNewWoPhotos] = useState<string[]>([]);

  // Persist to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workOrders));
    } catch (e) {
      console.warn('Failed to persist work orders:', e);
    }
  }, [workOrders]);

  // Firestore live subscription
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    try {
      const q = query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const remoteOrders: WorkOrderItem[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              code: data.code || `WO-${doc.id.slice(-4)}`,
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
              completedAt: data.completedAt,
              completedBy: data.completedBy,
              photoUrl: data.photoUrl,
              photos: data.photos || (data.photoUrl ? [data.photoUrl] : []),
              comments: data.comments || [],
              userId: data.userId,
              userEmail: data.userEmail,
              userName: data.userName,
            };
          });
          setWorkOrders(remoteOrders);
        },
        (error) => {
          console.warn('Firestore work orders listener error:', error);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to attach Firestore work orders listener:', err);
    }
  }, []);

  const handleWorkOrderSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newWoTitle.trim()) return;

      const codeNum = Math.floor(1000 + Math.random() * 9000);
      const code = `WO-${codeNum}`;
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

      setWorkOrders((prev) => [newOrder, ...prev]);
      setNewWoTitle('');
      setNewWoDescription('');
      setNewWoPhotos([]);
      setIsWorkOrderModalOpen(false);

      try {
        const firestoreId = await saveWorkOrderToFirestore(
          {
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
        if (firestoreId) {
          setWorkOrders((prev) =>
            prev.map((wo) => (wo.id === tempId ? { ...wo, id: firestoreId } : wo))
          );
        }
      } catch (err) {
        console.warn('Error syncing work order to Firestore:', err);
      }

      showToast?.('Work order request submitted!');
    },
    [newWoTitle, newWoDescription, newWoCategory, newWoPhotos, currentUser, workOrders, showToast]
  );

  const handleMarkAsDone = useCallback(
    (id: number | string) => {
      setWorkOrders((prev) =>
        prev.map((wo) =>
          String(wo.id) === String(id)
            ? {
                ...wo,
                status: 'Done',
                statusNote: `Completed by ${currentUser?.name || 'Maintenance Crew'}`,
                completedAt: new Date().toISOString(),
                completedBy: currentUser?.name || 'Maintenance Crew',
              }
            : wo
        )
      );
      updateFirestoreDocument('work_orders', id, {
        status: 'Done',
        statusNote: `Completed by ${currentUser?.name || 'Maintenance Crew'}`,
        completedAt: new Date().toISOString(),
        completedBy: currentUser?.name || 'Maintenance Crew',
      });
      showToast?.('Work order marked as done!');
    },
    [currentUser, showToast]
  );

  const handleCompleteWithReply = useCallback(
    async (id: number | string, text: string, photoUrl?: string) => {
      const resolutionComment: WorkOrderComment = {
        id: `c-${Date.now()}`,
        author: currentUser?.name || 'Maintenance Crew',
        role: currentUser?.role === 'crew' ? 'Maintenance Crew' : 'Staff',
        text: text.trim(),
        timestamp: 'Just now',
        photoUrl: photoUrl || '',
      };

      setWorkOrders((prev) =>
        prev.map((wo) =>
          String(wo.id) === String(id)
            ? {
                ...wo,
                status: 'Done',
                statusNote: `Completed by ${currentUser?.name || 'Maintenance Crew'}`,
                completedAt: new Date().toISOString(),
                completedBy: currentUser?.name || 'Maintenance Crew',
                comments: [...(wo.comments || []), resolutionComment],
              }
            : wo
        )
      );

      if (photoUrl) {
        await saveWorkOrderResolutionToFirestore({
          woId: id,
          replyText: text,
          photoDownloadUrl: photoUrl,
          crewUser: currentUser,
        });
      } else {
        updateFirestoreDocument('work_orders', id, {
          status: 'Done',
          statusNote: `Completed by ${currentUser?.name || 'Maintenance Crew'}`,
          completedAt: new Date().toISOString(),
          completedBy: currentUser?.name || 'Maintenance Crew',
          comments: resolutionComment,
        });
      }

      showToast?.('Work order resolved with verification photo!');
    },
    [currentUser, showToast]
  );

  const handleReopenWorkOrder = useCallback(
    (id: number | string) => {
      setWorkOrders((prev) =>
        prev.map((wo) =>
          String(wo.id) === String(id)
            ? {
                ...wo,
                status: 'In Progress',
                statusNote: 'Reopened for maintenance inspection',
                completedAt: undefined,
                completedBy: undefined,
              }
            : wo
        )
      );
      updateFirestoreDocument('work_orders', id, {
        status: 'In Progress',
        statusNote: 'Reopened for maintenance inspection',
      });
      showToast?.('Work order reopened');
    },
    [showToast]
  );

  const handleDeleteWorkOrder = useCallback(
    (id: number | string) => {
      setWorkOrders((prev) => prev.filter((wo) => String(wo.id) !== String(id)));
      deleteWorkOrderFromFirestore(id);
      showToast?.('Work order deleted');
    },
    [showToast]
  );

  const handleAddWorkOrderComment = useCallback(
    (woId: number | string, text: string, photoUrl?: string) => {
      if (!text.trim() && !photoUrl) return;
      const newComment: WorkOrderComment = {
        id: `c-${Date.now()}`,
        author: currentUser?.name || 'Resident',
        role: currentUser?.role === 'crew' ? 'Maintenance Crew' : 'Resident',
        text: text.trim(),
        timestamp: 'Just now',
        photoUrl: photoUrl || '',
      };

      setWorkOrders((prev) =>
        prev.map((wo) =>
          String(wo.id) === String(woId)
            ? { ...wo, comments: [...(wo.comments || []), newComment] }
            : wo
        )
      );
      showToast?.('Comment added');
    },
    [currentUser, showToast]
  );

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
