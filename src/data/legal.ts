/** Draft: owner approval and hosted policy verification are release gates. */
export const TERMS_VERSION = '2026-10-draft1';
export const PRIVACY_URL = 'https://townloop.web.app/privacy.html';
export const TERMS_URL = 'https://townloop.web.app/terms.html';
export const DELETE_ACCOUNT_URL = 'https://townloop.web.app/delete-account.html';

export function requireTermsAcceptance(accepted: unknown): void {
  if (accepted !== true) throw new Error('Please read and accept the TownLoop Terms of Use and acknowledge the Privacy Policy.');
}
