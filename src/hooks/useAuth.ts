/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { normalizeUserProfile, logoutUser } from '../services/auth';
import { isAdmin, isStaff, isVip, isCrew } from '../utils/permissions';

export interface UseAuthReturn {
  user: UserProfile | null;
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  role: UserRole;
  isAdmin: boolean;
  isStaff: boolean;
  isVip: boolean;
  isCrew: boolean;
  logout: () => Promise<void>;
}

/**
 * useAuth hook that listens directly to live Firebase Authentication and
 * subscribes in real-time to the user's Firestore profile document at `users/{uid}`.
 */
export function useAuth(): UseAuthReturn {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth || !db) {
      setIsLoading(false);
      return;
    }

    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      setFirebaseUser(fbUser);

      if (!fbUser) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        unsubDoc = onSnapshot(
          userDocRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const profile = normalizeUserProfile(fbUser.uid, snapshot.data(), fbUser);
              setCurrentUser(profile);
              setIsLoading(false);
            } else {
              // Try matching by email in users collection if doc by UID is not yet indexed
              try {
                if (fbUser.email && db) {
                  const q = query(collection(db, 'users'), where('email', '==', fbUser.email.toLowerCase()));
                  const emailSnap = await getDocs(q);
                  if (!emailSnap.empty) {
                    const profile = normalizeUserProfile(fbUser.uid, emailSnap.docs[0].data(), fbUser);
                    setCurrentUser(profile);
                    setIsLoading(false);
                    return;
                  }
                }
              } catch (e) {
                console.warn('[useAuth] Notice checking email match in users collection:', e);
              }
              const fallbackProfile = normalizeUserProfile(fbUser.uid, null, fbUser);
              setCurrentUser(fallbackProfile);
              setIsLoading(false);
            }
          },
          (error) => {
            console.warn('[useAuth] Error streaming user document from Firestore:', error);
            setCurrentUser(normalizeUserProfile(fbUser.uid, null, fbUser));
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.warn('[useAuth] Failed to attach Firestore user snapshot:', err);
        setCurrentUser(normalizeUserProfile(fbUser.uid, null, fbUser));
        setIsLoading(false);
      }
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, []);

  const role = currentUser?.role || '';

  return {
    user: currentUser,
    currentUser,
    firebaseUser,
    isLoading,
    isLoggedIn: Boolean(currentUser),
    role,
    isAdmin: isAdmin(currentUser),
    isStaff: isStaff(currentUser),
    isVip: isVip(currentUser),
    isCrew: isCrew(currentUser),
    logout: logoutUser,
  };
}
