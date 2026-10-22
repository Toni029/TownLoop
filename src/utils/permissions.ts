import type { UserProfile, UserRole } from '../types';

/** @deprecated Roles are sourced exclusively from the approved Firestore profile. */
export function isMasterAdminEmail(_email?: string | null): boolean {
  return false;
}

/** Only an explicitly approved canonical role grants privileges. Legacy aliases are data, not authority. */
export function getUserRole(user: UserProfile | null | undefined): UserRole {
  return user?.approved === true && user.deletionPending !== true && ['admin', 'vip', 'crew', 'resident'].includes(user.role || '')
    ? user.role as UserRole : '';
}
export function isAdmin(user: UserProfile | null | undefined): boolean {
  return getUserRole(user) === 'admin';
}
/** Staff is a display group for Admin/VIP, never a fifth authorizing role. */
export function isStaff(user: UserProfile | null | undefined): boolean {
  return ['admin', 'vip'].includes(getUserRole(user));
}
export function isVip(user: UserProfile | null | undefined): boolean {
  return isStaff(user);
}
export function isStrictVip(user: UserProfile | null | undefined): boolean {
  return getUserRole(user) === 'vip';
}
export function isCrew(user: UserProfile | null | undefined): boolean {
  return getUserRole(user) === 'crew';
}

/**
 * VIP & Admin can delete ANY post in Marketplace and Discussion Feed.
 * Regular residents can only delete their own posts.
 */
export function canDeleteAnyPost(user: UserProfile | null | undefined): boolean {
  return isVip(user);
}

/**
 * Every role (Admin, VIP, Crew, and Resident) is allowed to post
 * in Discussion Feed and Marketplace.
 */
export function canCreatePost(user: UserProfile | null | undefined): boolean {
  return !!getUserRole(user);
}

/**
 * ONLY Admin and VIP roles can see and use 'Upload/Edit Newsletter' tools.
 */
export function canManageNewsletter(user: UserProfile | null | undefined): boolean {
  return isVip(user);
}

/**
 * ONLY Admin and VIP roles can see and use trash can icons for 'Pinned Highlights'.
 */
export function canManagePinnedHighlights(user: UserProfile | null | undefined): boolean {
  return isVip(user);
}

/**
 * Residents, VIP, and Admin roles can create/post work order requests.
 * Crew role handles ticket servicing and completion.
 */
export function canCreateWorkOrder(user: UserProfile | null | undefined): boolean {
  const role = getUserRole(user);
  return role === 'resident' || role === 'vip' || role === 'admin';
}

/**
 * Checks whether the user is the creator/author of a work order.
 */
export function isWorkOrderCreator(
  workOrder: {
    userId?: string | number;
    userEmail?: string;
    userName?: string;
    unit?: string;
  } | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (!workOrder || !user) return false;

  // Match by userId if available
  if (workOrder.userId && user.id && String(workOrder.userId) === String(user.id)) {
    return true;
  }

  return false;
}

/**
 * Admin, VIP, and Crew can see all work orders in the system.
 */
export function canViewAllWorkOrders(user: UserProfile | null | undefined): boolean {
  const role = getUserRole(user);
  return role === 'admin' || role === 'vip' || role === 'crew' || isAdmin(user);
}

/**
 * A work order is ONLY visible to:
 * - Admin
 * - VIP
 * - Crew
 * - The person that created the work order (normal resident can only see his/hers).
 */
export function canViewWorkOrder(
  workOrder: {
    userId?: string | number;
    userEmail?: string;
    userName?: string;
    unit?: string;
  } | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (canViewAllWorkOrders(user)) {
    return true;
  }
  return isWorkOrderCreator(workOrder, user);
}

/** Managers may delete any ticket; residents only their own unfinished tickets. */
export function canDeleteWorkOrder(
  workOrder: {
    status?: string;
    userId?: string | number;
    userEmail?: string;
    userName?: string;
    unit?: string;
  } | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (!user || !workOrder) return false;
  const role = getUserRole(user);
  if (role === 'admin' || role === 'vip') return true;
  return role === 'resident' && workOrder.status !== 'Done' && isWorkOrderCreator(workOrder, user);
}

/**
 * Checks whether user can delete without proof (now applies to all valid deletion permissions).
 */
export function canDeleteWorkOrderWithoutProof(
  workOrder: {
    status?: string;
    userId?: string | number;
    userEmail?: string;
    userName?: string;
    unit?: string;
  } | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  return canDeleteWorkOrder(workOrder, user);
}

/**
 * Backward compatibility alias for canDeleteWorkOrder.
 */
export function canDeleteWorkOrderWithProof(
  workOrder: {
    status?: string;
    userId?: string | number;
    userEmail?: string;
    userName?: string;
    unit?: string;
  } | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  return canDeleteWorkOrder(workOrder, user);
}

/**
 * Crucially, ONLY the Crew role should see and use the 'Mark as Done' button.
 * (Admins, VIPs, and residents CANNOT mark work orders as done).
 */
export function canCompleteWorkOrder(user: UserProfile | null | undefined): boolean {
  return isCrew(user);
}

/**
 * Crucially, ONLY the Crew role should see and use the work order photo upload tool.
 */
export function canUploadWorkOrderPhoto(user: UserProfile | null | undefined): boolean {
  return isCrew(user);
}

/**
 * Crucially, ONLY the Crew role should see and use the work order comment box.
 */
export function canCommentOnWorkOrder(user: UserProfile | null | undefined): boolean {
  return isCrew(user);
}

/**
 * Show the master Admin Panel to both Admin and VIP roles.
 */
export function canAccessAdminPanel(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const role = getUserRole(user);
  return role === 'admin' || role === 'vip' || role === 'staff';
}

/**
 * Human readable badge format for user role
 */
export function getRoleBadgeInfo(role: UserRole) {
  switch (role) {
    case 'admin':
      return {
        label: 'Admin',
        bg: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    case 'staff':
      return {
        label: 'Staff',
        bg: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-800',
        dot: 'bg-indigo-500',
      };
    case 'vip':
      return {
        label: 'VIP',
        bg: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800',
        dot: 'bg-purple-500',
      };
    case 'crew':
      return {
        label: 'Maintenance Crew',
        bg: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500',
      };
    case '':
      return {
        label: 'Pending Applicant',
        bg: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    default:
      return {
        label: 'Resident',
        bg: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
      };
  }
}

export function canTranslateWorkOrder(user: UserProfile | null | undefined): boolean {
  return !!user && user.approved === true && ['admin', 'vip', 'crew'].includes(user.role || '');
}
