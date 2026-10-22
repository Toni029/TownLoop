import { requireTermsAcceptance, TERMS_VERSION } from "../../../src/data/legal";
export const googleSignInAvailable = false; // Native OAuth and Expo registration consent are not configured for release.
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
export async function googleSignIn(termsAccepted = false) {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  const reference = doc(db, "users", user.uid);
  if (!(await getDoc(reference)).exists()) {
    if (!termsAccepted) { await signOut(auth); requireTermsAcceptance(false); }
    await setDoc(reference, {
      termsVersion: TERMS_VERSION, termsAcceptedAt: serverTimestamp(),
      id: user.uid,
      name: user.displayName || "Resident",
      email: user.email,
      role: "resident",
      address: "",
      avatarUrl: user.photoURL || "",
      approved: false,
      createdAt: new Date().toISOString(),
    });
  }
}
