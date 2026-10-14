import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
export async function googleSignIn() {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  const reference = doc(db, "users", user.uid);
  if (!(await getDoc(reference)).exists())
    await setDoc(reference, {
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
