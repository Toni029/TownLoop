import { UserProfile, UserRole } from '../types';

/** @deprecated Roles are sourced exclusively from the approved Firestore profile. */
export function isMasterAdminEmail(_email?: string | null): boolean {
  return false;
}

/**
 * Resolves the effective role for a user profile:
 * 1. Hardcoded admin emails ('amerlano@frontporch.net', 'CPURDY@frontporch.net') are always 'admin'.
 * 2. Explicit user.role === 'admin' -> 'admin'.
 * 3. Explicit user.role === 'vip' -> 'vip'.
 * 4. Explicit user.role === 'crew' -> 'crew'.
 * 5. Default fallback -> 'resident'.
 */
export function getUserRole(user: UserProfile | null | undefined): UserRole {
  if (!user || user.approved === false) return '';
  const r = (user.role || '').toLowerCase().trim();
  if (r === 'admin' || r === 'master admin' || r === 'master_admin') return 'admin';
  if (r === 'vip' || r === 'vip resident' || r === 'vip_resident') return 'vip';
  if (r === 'crew' || r === 'maintenance' || r === 'maintenance crew') return 'crew';
  if (r === '') return '';
  if (r === 'resident') return 'resident';
  return 'resident';
}

/**
 * True if user is Admin (either master admin email or role === 'admin').
 */
export function isAdmin(user: UserProfile | null | undefined): boolean {
  return getUserRole(user) === 'admin';
}

/**
 * True if user is VIP (role === 'vip') or higher (Admin).
 */
export function isVip(user: UserProfile | null | undefined): boolean {
  const role = getUserRole(user);
  return role === 'vip' || role === 'admin';
}

/**
 * True strictly if user is VIP role only (role === 'vip', excluding admin/crew/resident).
 */
export function isStrictVip(user: UserProfile | null | undefined): boolean {
  return getUserRole(user) === 'vip';
}

/**
 * True if user is Crew (role === 'crew').
 */
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
  return true;
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

/**
 * Work Order Deletion Rules:
 * 1. Admin and VIP roles: Can delete ANY work order, without proof of anything.
 * 2. Crew role: Can mark as done (with required comment and photo). Once the work order is marked as Done,
 *    the trashcan icon is displayed and they can delete the work order. ONLY when marked as Done can crew delete it.
 * 3. Resident role: Can delete their own work order without proof or requirement.
 *    IF the work order is marked as Done (greyed out), they NO LONGER have the trashcan icon and CANNOT delete it.
 */
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
  if (!user) return false;

  // 1. Admin and VIP roles can delete ANY work order without proof
  if (isAdmin(user) || isVip(user)) {
    return true;
  }

  // 2. Crew role: ONLY when the work order is marked as Done, they can delete it
  if (isCrew(user)) {
    return workOrder?.status === 'Done';
  }

  // 3. Resident role:
  // If the work order is marked as Done (greyed out), they cannot delete it and have no trashcan icon
  if (workOrder?.status === 'Done') {
    return false;
  }

  // If not marked as Done, resident can delete their own work order post without proof
  return isWorkOrderCreator(workOrder, user);
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
  return role === 'admin' || role === 'vip';
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
