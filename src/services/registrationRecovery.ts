/** Password verification is required even when a matching account is already signed in. */
export async function obtainRegistrationUser<T>(options: {
  email: string;
  currentEmail?: string | null;
  create: () => Promise<T>;
  signIn: () => Promise<T>;
}): Promise<T> {
  if (options.currentEmail?.trim().toLowerCase() === options.email.trim().toLowerCase()) {
    return options.signIn();
  }
  try {
    return await options.create();
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/email-already-in-use') throw error;
    return options.signIn();
  }
}

export const INCOMPLETE_REGISTRATION_MESSAGE = 'Your sign-in account is ready, but your resident profile could not be saved. Keep your details and retry Create Account with the same email and password. After reopening, enter your details and accept the terms again to finish registration.';
export const MISSING_REGISTRATION_MESSAGE = 'Your sign-in account has no resident profile. Sign out if needed, choose Create Account, enter your details with the same email and password, and accept the terms to finish registration. If this is unexpected, contact the community office.';
