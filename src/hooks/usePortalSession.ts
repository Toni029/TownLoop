import type React from 'react';
import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { useAuth } from './useAuth';

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
  // Always clean up any stale or hardcoded demo user data from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const { currentUser: liveUser, isLoading: isAuthLoading } = useAuth();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoggedOut, setIsLoggedOut] = useState<boolean>(false);
  const [authLoadingState, setAuthLoadingState] = useState<boolean>(true);

  // Synchronize state with live Firebase Auth & Firestore user doc
  useEffect(() => {
    setCurrentUser(liveUser);
    setIsLoggedOut(!liveUser && !isAuthLoading);
    setAuthLoadingState(isAuthLoading);
  }, [liveUser, isAuthLoading]);

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

  return {
    currentUser,
    setCurrentUser,
    isLoggedOut,
    setIsLoggedOut,
    isAuthLoading: authLoadingState,
    setIsAuthLoading: setAuthLoadingState,
    isDarkMode,
    setIsDarkMode,
  };
}
