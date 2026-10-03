export type ResidentProfile = {
    name: string;
    email: string;
    role: string;
    approved: boolean;
    address: string;
};
// Access follows the deployed rules' canonical approved field, not cached role flags.
export function readProfile(data: Record<string, unknown>): ResidentProfile {
    const text = (...values: unknown[]) => values.find(v => typeof v === 'string' && v.trim()) as string || '';
    return {
        name: text(data.displayName, data.name, data.display_name, data.fullName, data.full_name) || 'Resident',
        email: text(data.email),
        role: text(data.role, data.userRole, data.user_role),
        approved: data.approved !== false,
        address: text(data.address, data.unit),
    };
}
export function friendlyError(error: unknown): string {
    const code = (error as {
        code?: string;
    })?.code;
    switch (code) {
        case 'auth/invalid-email': return 'Please enter a valid email address.';
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password': return 'The email or password was not recognized.';
        case 'auth/too-many-requests': return 'Too many attempts. Please wait and try again.';
        case 'auth/network-request-failed': return 'Unable to connect. Check your internet connection and try again.';
        case 'permission-denied': return 'Your account does not have access to this information. Please contact your community office.';
        default: return 'Unable to complete this request. Please try again.';
    }
}
