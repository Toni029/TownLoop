import type React from 'react';
import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { subscribeToAuth } from '../services/auth';
import { isFirebaseConfigured } from '../firebase';

const THEME_STORAGE_KEY = 'portal_theme_dark';
const USER_STORAGE_KEY = 'portal_current_user';

const DEFAULT_DEMO_USER: UserProfile = {
  id: 'resident-demo',
  name: 'Alex Mitchell',
  email: 'alex.mitchell@cecilpines.org',
  role: 'admin',
  address: 'Unit 208 • Magnolia Court',
  wing: 'Magnolia Court',
  phone: '(904) 555-0142',
  emergency_contact: 'Sarah Mitchell (Daughter) - (904) 555-0199',
  emergencyContact: 'Sarah Mitchell (Daughter) - (904) 555-0199',
  dietary_preference: 'Low Sodium / Diabetic Friendly',
  dietaryPreference: 'Low Sodium / Diabetic Friendly',
  avatar_url:
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
  avatarUrl:
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
  approved: true,
  created_at: new Date().toISOString(),
};

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
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_DEMO_USER;
  });

  const [isLoggedOut, setIsLoggedOut] = useState(false);
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
