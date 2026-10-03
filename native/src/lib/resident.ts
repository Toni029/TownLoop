import { useMemo } from 'react';
import { useSession } from './session';
import type { UserProfile } from '../../../src/types';
export function useResident(): UserProfile | null {
  const { user, profile } = useSession();
  return useMemo(() => user && profile ? {
    ...profile.source, ...profile, id: user.uid,
    name: profile.name, email: profile.email || user.email || '',
  } as UserProfile : null, [user, profile]);
}
