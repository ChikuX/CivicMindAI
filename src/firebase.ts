import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAVvLo5qyP_-cTUx6Kd1wpodUfck611XsY",
  authDomain: "gen-lang-client-0495975164.firebaseapp.com",
  projectId: "gen-lang-client-0495975164",
  storageBucket: "gen-lang-client-0495975164.firebasestorage.app",
  messagingSenderId: "1062637553195",
  appId: "1:1062637553195:web:685f897739ba10537acc6e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use the custom database ID provided in firebase-applet-config.json
export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-bbe88630-81d6-49c9-9aa9-d68fa1fe4649");
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  const errString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errString);
  throw new Error(errString);
}
