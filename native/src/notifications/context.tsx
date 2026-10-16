import { createContext, useContext, type PropsWithChildren } from 'react';
import type { Category } from '../profile/model';
export type InboxTarget = { category: Category; id: string; recipientId: string; requestId: string };
export const PushContext = createContext<{
  target: InboxTarget | null; consume: () => void; enable: () => Promise<void>; status: string;
}>({ target: null, consume: () => {}, enable: async () => {}, status: '' });
export const useInboxPush = () => useContext(PushContext);
// Browser keeps its existing in-app notifications.
export function InboxPushProvider({ children }: PropsWithChildren) { return children; }
