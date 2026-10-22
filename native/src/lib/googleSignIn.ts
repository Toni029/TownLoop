export const googleSignInAvailable = false;
/** Native Google OAuth needs platform client IDs and a configured development build. */
export async function googleSignIn(): Promise<void> {
  throw new Error(
    "Google sign-in on this device needs the community’s Android/iOS Google OAuth configuration. Email sign-in is available.",
  );
}
