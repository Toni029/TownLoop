/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import {
  auth,
  db,
  isFirebaseConfigured,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { UserProfile, UserRole } from '../types';

/**
 * Normalizes Firestore or Auth data into consistent UserProfile structure
 */
function normalizeUserProfile(uid: string, data: any, fbUser?: FirebaseUser | null): UserProfile {
  const email = data?.email || fbUser?.email || '';
  const name = data?.name || fbUser?.displayName || 'Resident';
  const approved = data?.approved !== false;
  const storedRole = String(data?.role || '').toLowerCase();
  const role: UserRole = approved && ['admin', 'vip', 'crew', 'resident'].includes(storedRole)
    ? storedRole as UserRole
    : '';

  let cachedSignupAddr = '';
  if (typeof window !== 'undefined') {
    try {
      cachedSignupAddr = (email ? sessionStorage.getItem(`cecil_pines_registered_address_${email.toLowerCase()}`) : null)
        || sessionStorage.getItem('cecil_pines_registered_address')
        || '';
    } catch {}
  }

  // Pure single address field - mapping exactly to user entered street address
  const address = data?.address !== undefined
    ? data.address
    : cachedSignupAddr;

  // No mock data fallbacks for newly registered residents - only populate if actually present in doc
  const phone = data?.phone !== undefined ? data.phone : undefined;
  const emergencyContact = data?.emergencyContact || data?.emergency_contact || undefined;
  const dietaryPreference = data?.dietaryPreference || data?.dietary_preference || undefined;
  const wing = data?.wing || undefined;
  const avatarUrl = data?.avatarUrl || data?.avatar_url || fbUser?.photoURL || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80';

  return {
    id: uid,
    name,
    email,
    role,
    address,
    wing,
    phone,
    emergency_contact: emergencyContact,
    emergencyContact,
    dietary_preference: dietaryPreference,
    dietaryPreference,
    avatar_url: avatarUrl,
    avatarUrl,
    approved,
    created_at: data?.createdAt || new Date().toISOString()
  };
}

/**
 * Authenticates resident with email and password via Firebase Auth
 */
export async function loginUser(email: string, password: string): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();

  // Standard Resident Sign-In
  if (isFirebaseConfigured() && auth && db) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // Fetch resident profile from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      let userData: any = null;

      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          userData = snap.data();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

        if (!userData) {
        // If Firestore doc does not exist yet, initialize it with role: ""
        userData = {
          id: user.uid,
          name: user.displayName || cleanEmail.split('@')[0] || 'Resident',
          email: user.email || cleanEmail,
          role: "", // default to empty string
          address: '',
          avatarUrl: user.photoURL || '',
          approved: false, // Strict Admin Approval requirement
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(userDocRef, userData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
      }

      return normalizeUserProfile(user.uid, userData, user);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password. If you do not have an account yet, please use the "Create Account" tab.');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Access is temporarily locked. Please try again shortly.');
      }

      throw new Error(err.message || 'Firebase sign in failed');
    }
  }

  throw new Error('Authentication is not configured. Please contact the community administrator.');
}

/**
 * Registers new resident with Firebase Auth and persists profile in Firestore
 */
export async function signupUser(params: {
  name: string;
  email: string;
  password: string;
  address?: string;
  phone?: string;
}): Promise<UserProfile> {
  const { name, email, password, address, phone } = params;
  const userStreetAddress = address ? address.trim() : '';

  if (typeof window !== 'undefined' && userStreetAddress) {
    try {
      sessionStorage.setItem('cecil_pines_registered_address', userStreetAddress);
      sessionStorage.setItem(`cecil_pines_registered_address_${email.trim().toLowerCase()}`, userStreetAddress);
      localStorage.setItem('cecil_pines_registered_address', userStreetAddress);
    } catch {}
  }

  if (isFirebaseConfigured() && auth && db) {
    try {
      // 1. Create account in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Update Auth display name
      await updateProfile(user, { displayName: name.trim() });

      // 3. Persist resident profile document in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const profileData: Record<string, any> = {
        id: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: "", // Auto-Create Role on Registration: strictly defaulted to empty string (pending)
        address: userStreetAddress,
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
        approved: false, // Strict Admin Approval requirement
        createdAt: new Date().toISOString()
      };

      if (phone && phone.trim()) {
        profileData.phone = phone.trim();
      }

      try {
        await setDoc(userDocRef, profileData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
      }

      return normalizeUserProfile(user.uid, profileData, user);
    } catch (err: any) {
      console.error('Firebase registration failed:', err);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please log in.');
      } else if (err.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      }
      throw new Error(err.message || 'Failed to create resident account in Firebase');
    }
  }

  throw new Error('Account registration is not configured. Please contact the community administrator.');
}

/**
 * Sign in with Google popup via Firebase Auth
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  if (isFirebaseConfigured() && auth && db) {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      let userData: any = null;

      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          userData = snap.data();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!userData) {
        userData = {
          id: user.uid,
          name: user.displayName || 'Resident',
          email: user.email || '',
          role: "", // default to empty string
          address: '',
          avatarUrl: user.photoURL || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
          approved: false, // Strict Admin Approval requirement
          createdAt: new Date().toISOString()
        };

        if (user.phoneNumber) {
          userData.phone = user.phoneNumber;
        }

        try {
          await setDoc(userDocRef, userData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
      }

      const normalized = normalizeUserProfile(user.uid, userData, user);
      return normalized;
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        throw new Error('Sign-in popup was closed before completion.');
      }
      console.warn('Google sign in:', err?.message || err);
      throw new Error(err.message || 'Google authentication failed');
    }
  }

  throw new Error('Google sign-in is not configured. Please contact the community administrator.');
}

/**
 * Directly checks latest approval status of a resident from Firestore server
 */
export async function checkUserApprovalStatus(userId: string | number): Promise<boolean> {
  const uidStr = String(userId);

  if (isFirebaseConfigured() && db) {
    try {
      const userDocRef = doc(db, 'users', uidStr);
      let snap = null;
      snap = await getDocFromServer(userDocRef);
      if (snap && snap.exists()) {
        const data = snap.data();
        return Boolean(data.approved === true);
      }
    } catch (err) {
      console.warn('Error checking approval status in Firestore:', err);
    }
  }

  return false;
}

/**
 * Updates a resident's approval status (and optional role) in Firestore
 */
export async function setAdminApprovalStatus(
  userId: string | number,
  approved: boolean,
  role?: UserRole
): Promise<boolean> {
  const uidStr = String(userId);
  const updatePayload: Record<string, any> = { approved };
  if (role !== undefined) {
    updatePayload.role = role;
  }

  if (isFirebaseConfigured() && db && auth?.currentUser) {
    try {
      const userDocRef = doc(db, 'users', uidStr);
      await updateDoc(userDocRef, updatePayload);
      return true;
    } catch (err) {
      console.error('Failed to update approval status in Firestore:', err);
    }
  }
  return false;
}

/**
 * Auto-Assign Role on Approval:
 * When an Admin or VIP clicks the 'Approve' button inside the Admin Panel,
 * automatically update that specific user's Firestore document to set approved: true
 * AND set role: 'resident' simultaneously.
 */
export async function approveUserAndAssignResident(userId: string | number): Promise<boolean> {
  return setAdminApprovalStatus(userId, true, 'resident');
}

/**
 * Subscribes to all registered community users in Firestore for the Admin Panel
 */
export function subscribeToCommunityDirectory(
  callback: (users: Array<{
    id: string;
    name: string;
    email: string;
    unit: string;
    role: UserRole;
    approved?: boolean;
    avatar?: string;
    createdAt?: string;
    phone?: string;
    wing?: string;
    address?: string;
    interests?: string[];
  }>) => void
): () => void {
  const notifyMergedList = (firestoreUsers: any[] = []) => {
    const userMapById = new Map<string, any>();
    const emailToId = new Map<string, string>();

    const upsert = (u: any) => {
      if (!u || !u.id) return;
      const cleanId = String(u.id).trim();
      const cleanEmail = (u.email || '').toLowerCase().trim();

      // Check if we already have this user registered under their email
      let targetId = cleanId;
      if (cleanEmail && emailToId.has(cleanEmail)) {
        targetId = emailToId.get(cleanEmail)!;
      }

      if (userMapById.has(targetId)) {
        const existing = userMapById.get(targetId);
        userMapById.set(targetId, {
          ...existing,
          ...u,
          id: targetId, // preserve canonical unique ID
        });
      } else {
        userMapById.set(cleanId, {
          ...u,
          id: cleanId,
        });
        if (cleanEmail) {
          emailToId.set(cleanEmail, cleanId);
        }
      }
    };

    firestoreUsers.forEach((u) => {
      upsert(u);
    });

    callback(Array.from(userMapById.values()));
  };

  let unsubscribeFirestore = () => {};

  if (isFirebaseConfigured() && db) {
    try {
      const usersCol = collection(db, 'users');
      unsubscribeFirestore = onSnapshot(
        usersCol,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const isApproved = data.approved !== false;
            const resolvedRole = isApproved && ['admin', 'vip', 'crew', 'resident'].includes(data.role)
              ? data.role
              : '';

            return {
              id: docSnap.id,
              name: data.name || 'Resident',
              email: data.email || '',
              unit: data.address || data.unit || 'Cecil Pines Community',
              role: resolvedRole as UserRole,
              approved: isApproved,
              avatar: data.avatarUrl || data.avatar_url || data.avatar || '',
              createdAt: data.createdAt,
              phone: data.phone || '',
              wing: data.wing || '',
              address: data.address || data.unit || '',
              interests: data.interests || ['Community'],
            };
          });
          notifyMergedList(list);
        },
        (error) => {
          console.warn('Community directory listener notice:', error);
          notifyMergedList([]);
        }
      );
    } catch (err) {
      console.warn('Could not bind directory listener:', err);
      notifyMergedList([]);
    }
  } else {
    notifyMergedList([]);
  }

  return () => {
    unsubscribeFirestore();
  };
}

/**
 * Subscribes to Firebase Authentication state changes
 */
export function subscribeToAuth(callback: (user: UserProfile | null) => void): () => void {
  let docUnsubscribe: (() => void) | null = null;

  if (isFirebaseConfigured() && auth && db) {
    const authUnsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (docUnsubscribe) {
        docUnsubscribe();
        docUnsubscribe = null;
      }

      if (!fbUser) {
        callback(null);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        docUnsubscribe = onSnapshot(
          userDocRef,
          (snap) => {
            if (snap.exists()) {
              const normalized = normalizeUserProfile(fbUser.uid, snap.data(), fbUser);
              callback(normalized);
            } else {
              const normalized = normalizeUserProfile(fbUser.uid, null, fbUser);
              callback(normalized);
            }
          },
          (err) => {
            console.warn('User profile snapshot notice:', err);
            callback(normalizeUserProfile(fbUser.uid, null, fbUser));
          }
        );
      } catch (err) {
        console.warn('Error binding snapshot on user profile:', err);
        callback(normalizeUserProfile(fbUser.uid, null, fbUser));
      }
    });

    return () => {
      if (docUnsubscribe) docUnsubscribe();
      authUnsubscribe();
    };
  }

  callback(null);
  return () => {};
}

/**
 * Fetches current active user session
 */
export async function fetchCurrentUser(): Promise<UserProfile | null> {
  if (isFirebaseConfigured() && auth && db) {
    const currentFbUser = auth.currentUser;
    if (!currentFbUser) return null;

    try {
      const snap = await getDoc(doc(db, 'users', currentFbUser.uid));
      if (snap.exists()) {
        return normalizeUserProfile(currentFbUser.uid, snap.data(), currentFbUser);
      }
      return normalizeUserProfile(currentFbUser.uid, null, currentFbUser);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${currentFbUser.uid}`);
    }
  }

  return null;
}

/**
 * Updates resident profile fields in Firestore
 */
export async function updateResidentProfile(params: Partial<UserProfile>): Promise<UserProfile> {
  if (isFirebaseConfigured() && auth && db && auth.currentUser) {
    const uid = auth.currentUser.uid;
    const userDocRef = doc(db, 'users', uid);

    const updatePayload: any = {};
    if (params.name) updatePayload.name = params.name.trim();
    if (params.address !== undefined) updatePayload.address = params.address.trim();
    if (params.avatar_url || params.avatarUrl) {
      const avatar = (params.avatar_url || params.avatarUrl)!.trim();
      updatePayload.avatarUrl = avatar;
    }
    if (params.wing !== undefined) updatePayload.wing = params.wing.trim();
    if (params.phone !== undefined) updatePayload.phone = params.phone.trim();
    if (params.emergency_contact || params.emergencyContact) {
      const em = (params.emergency_contact || params.emergencyContact)!.trim();
      updatePayload.emergencyContact = em;
    }
    if (params.dietary_preference || params.dietaryPreference) {
      const diet = (params.dietary_preference || params.dietaryPreference)!.trim();
      updatePayload.dietaryPreference = diet;
    }

    try {
      await updateDoc(userDocRef, updatePayload);
      const updatedSnap = await getDoc(userDocRef);
      return normalizeUserProfile(uid, updatedSnap.data(), auth.currentUser);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  }

  throw new Error('Profile updates require an authenticated Firebase session.');
}

/**
 * Updates a user's role in Firestore or LocalStorage (for admin management)
 */
export async function updateUserRoleInDb(userId: string | number, role: UserRole): Promise<boolean> {
  const uidStr = String(userId);

  if (isFirebaseConfigured() && db) {
    try {
      const userDocRef = doc(db, 'users', uidStr);
      await updateDoc(userDocRef, { role });
      return true;
    } catch (err) {
      console.error('Failed to update role in Firestore:', err);
    }
  }

  return false;
}

/**
 * Safely signs out resident
 */
export async function logoutUser(): Promise<void> {
  if (isFirebaseConfigured() && auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Firebase signOut error:', err);
    }
  }
}

/**
 * Sends a password reset email using Firebase Authentication
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new Error('Please enter your email address first.');
  }

  if (isFirebaseConfigured() && auth) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return;
    } catch (err: any) {
      console.error('Firebase password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please try again later.');
      }
      throw new Error(err.message || 'Could not send password reset email.');
    }
  }

  throw new Error('Password reset is not configured. Please contact the community administrator.');
}
