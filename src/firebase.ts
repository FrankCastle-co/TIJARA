import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyASvlLg-RNCajyTQV58WzFjtPjE2T8go9Q",
  authDomain: "infra-pentameter-707pf.firebaseapp.com",
  projectId: "infra-pentameter-707pf",
  storageBucket: "infra-pentameter-707pf.firebasestorage.app",
  messagingSenderId: "601377593609",
  appId: "1:601377593609:web:30e41e91a76ed2b0321bd8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with long-polling to work seamlessly inside iframes/proxied sandboxes
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, "ai-studio-ecomcompanion-9a75dbdf-b9f2-4af3-8cf8-45fdd5fcb32f");

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Standardize Firestore Operation types and Error Handling as requested by the Firebase Integration skill
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection testing as requested in the Firebase Integration skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.warn("Firebase is offline. Check connection.");
    }
  }
}
testConnection();

export { app, db, auth, googleProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile };
