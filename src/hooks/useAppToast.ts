/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { useState } from 'react';

// Called unconditionally by App so state survives tab and authentication view changes.
export function useAppToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showAppToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  return {
    toastMessage,
    setToastMessage,
    showAppToast,
  };
}

export type AppToastState = ReturnType<typeof useAppToast>;
