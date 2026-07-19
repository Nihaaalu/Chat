import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)";

// Validate required environment variables
const REQUIRED_ENV_VARS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

export const missingEnvVars: string[] = [];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!import.meta.env[envVar]) {
    missingEnvVars.push(envVar);
  }
}

export const isFirebaseConfigured = missingEnvVars.length === 0;

export let app: any = null;
export let db: any = null;
export let auth: any = null;
export let appCheck: any = null;
export let initError: string | null = null;
export let appCheckInitError: string | null = null;
export let appCheckStatus: "success" | "failed" | "uninitialized" = "uninitialized";

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 
      ? initializeApp(firebaseConfig)
      : getApp();

    db = getFirestore(app, databaseId);
    auth = getAuth(app);

    // Initialize App Check gracefully after Firebase initialized
    try {
      if (typeof window !== "undefined") {
        const siteKey = "6LcV9FotAAAAAG-WC6mATFYjJMTOfoFmT76oRaa0";
        console.log("=== Firebase App Check Startup Diagnostics ===");
        console.log("Firebase App Name:", app?.name);
        console.log("App Check Site Key:", siteKey);
        console.log("Provider Type: ReCaptchaEnterpriseProvider");
        console.log("Hostname:", window.location.hostname);
        console.log("===============================================");

        appCheck = initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
        appCheckStatus = "success";
        console.log("Firebase App Check initialized successfully.");
      }
    } catch (err: any) {
      appCheckStatus = "failed";
      appCheckInitError = err instanceof Error ? err.message : String(err);
      console.error("Firebase App Check failed to initialize:", err);
    }
  } catch (error: any) {
    initError = error instanceof Error ? error.message : String(error);
    console.error("Firebase initialization failed:", error);
  }
} else {
  initError = `Missing required environment variables: ${missingEnvVars.join(", ")}`;
}

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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
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
