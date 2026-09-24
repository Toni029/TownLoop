/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
export {
  app,
  auth,
  db,
  storage,
  firebaseConfig,
  isFirebaseConfigured,
  isStorageConfigured,
  handleFirestoreError,
  testFirestoreConnection,
  OperationType,
} from '../firebase';
export type { FirestoreErrorInfo } from '../firebase';
