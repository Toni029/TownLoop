import type React from 'react';
import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { subscribeToAuth } from '../services/auth';
import { isFirebaseConfigured } from '../firebase';

const THEME_STORAGE_KEY = 'portal_theme_dark';
const USER_STORAGE_KEY = 'portal_current_user';

export interface PortalSessionState {
  currentUser: UserProfile | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  isLoggedOut: boolean;
  setIsLoggedOut: React.Dispatch<React.SetStateAction<boolean>>;
  isAuthLoading: boolean;
  setIsAuthLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePortalSession(): PortalSessionState {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clear any old hardcoded demo user so user starts clean
        if (
          parsed?.id === 'resident-demo' ||
          parsed?.email === 'alex.mitchell@cecilpines.org' ||
          parsed?.name === 'Alex Mitchell'
        ) {
          localStorage.removeItem(USER_STORAGE_KEY);
          return null;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoggedOut, setIsLoggedOut] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (!saved) return true;
      const parsed = JSON.parse(saved);
      if (
        parsed?.id === 'resident-demo' ||
        parsed?.email === 'alex.mitchell@cecilpines.org' ||
        parsed?.name === 'Alex Mitchell'
      ) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Sync dark mode class with root html
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, String(isDarkMode));
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  // Save current user to localStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Subscribe to Firebase Auth if configured
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    setIsAuthLoading(true);

    const unsubscribe = subscribeToAuth((fbUser) => {
      setIsAuthLoading(false);
      if (fbUser) {
        setCurrentUser(fbUser);
        setIsLoggedOut(false);
      } else {
        setCurrentUser(null);
        setIsLoggedOut(true);
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    currentUser,
    setCurrentUser,
    isLoggedOut,
    setIsLoggedOut,
    isAuthLoading,
    setIsAuthLoading,
    isDarkMode,
    setIsDarkMode,
  };
}
