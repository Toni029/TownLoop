/** The existing native Google provider is not configured in this checkpoint. */
export async function reauthenticateDeletionGoogle(): Promise<void> {
  throw new Error('Google account deletion requires the configured Google sign-in flow. Use the TownLoop web deletion page, or a configured Google build.');
}
