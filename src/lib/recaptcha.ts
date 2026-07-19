import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase.js";

declare global {
  interface Window {
    grecaptcha: any;
  }
}

const SITE_KEY = "6LcV9FotAAAAAG-WC6mATFYjJMTOfoFmT76oRaa0";

/**
 * Initialize the Firebase Cloud Function reference safely
 */
let verifyRecaptchaFn: any = null;
try {
  if (app) {
    const functions = getFunctions(app);
    verifyRecaptchaFn = httpsCallable(functions, "verifyRecaptcha");
  }
} catch (err) {
  console.warn("Firebase Functions failed to initialize, will use local proxy fallback:", err);
}

/**
 * Executes reCAPTCHA Enterprise for the given action and returns a fresh token.
 */
export function executeRecaptcha(action: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("window is not defined"));
    }

    const grecaptcha = window.grecaptcha;
    if (!grecaptcha || !grecaptcha.enterprise) {
      return reject(
        new Error("reCAPTCHA Enterprise is still loading. Please try again in a moment.")
      );
    }

    grecaptcha.enterprise.ready(async () => {
      try {
        const token = await grecaptcha.enterprise.execute(SITE_KEY, { action });
        if (!token) {
          return reject(new Error("reCAPTCHA execution returned an empty token."));
        }
        resolve(token);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Helper to execute reCAPTCHA Enterprise and immediately verify it.
 * This conforms to the production architecture by calling the verifyRecaptcha()
 * Firebase Cloud Function, falling back to local Express proxy for AI Studio local preview.
 */
/**
 * Helper to execute reCAPTCHA Enterprise and immediately verify it.
 * This conforms to the production architecture by calling the verifyRecaptcha()
 * Firebase Cloud Function.
 */
export async function runVerification(action: string): Promise<void> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "ruby-random-chat-app";
  const siteKey = "6LcV9FotAAAAAG-WC6mATFYjJMTOfoFmT76oRaa0";
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "N/A";
  const currentHostname = typeof window !== "undefined" ? window.location.hostname : "N/A";
  const currentEnv = import.meta.env.MODE;

  // Print diagnostics before every verification request
  console.log("=== Production URL & Verification Diagnostics ===");
  console.log("Firebase project:", projectId);
  console.log("Cloud Function URL:", `https://us-central1-${projectId}.cloudfunctions.net/verifyRecaptcha`);
  console.log("App Check provider: ReCaptchaEnterpriseProvider");
  console.log("reCAPTCHA Enterprise key:", siteKey);
  console.log("Current origin:", currentOrigin);
  console.log("Current hostname:", currentHostname);
  console.log("Current environment:", currentEnv);
  console.log("================================================");

  // Client-side dev mode bypass as suggested
  if (import.meta.env.DEV) {
    console.log(`[Dev Bypass] Client bypassed reCAPTCHA for action: ${action}`);
    return;
  }

  let token: string;
  try {
    token = await executeRecaptcha(action);
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("App Check") || errMsg.includes("appCheck") || errMsg.includes("exchange")) {
      throw new Error(`App Check initialization failed: ${errMsg}`);
    }
    if (errMsg.includes("site key") || errMsg.includes("siteKey")) {
      throw new Error(`Invalid site key: ${errMsg}`);
    }
    throw new Error(`reCAPTCHA verification failed: ${errMsg}`);
  }

  if (!verifyRecaptchaFn) {
    throw new Error("Cloud Function not deployed: verification function is uninitialized.");
  }

  try {
    const response: any = await verifyRecaptchaFn({ token, action });
    const data = response.data;
    if (data && typeof data === "object") {
      if (!data.success) {
        // Map specific error codes to user-friendly messages
        const errType = data.error || "";
        const details = data.details || "";
        if (errType === "INVALID_TOKEN") {
          throw new Error(`Invalid App Check token: ${details}`);
        } else if (errType === "LOW_RISK_SCORE") {
          throw new Error(`reCAPTCHA verification failed: risk score below threshold (Score: ${data.score})`);
        } else if (details.toLowerCase().includes("permission") || errType.toLowerCase().includes("permission")) {
          throw new Error("Permission denied");
        } else {
          throw new Error(`${errType}: ${details}`);
        }
      }
      return; // Success! Authorized via Firebase Cloud Function
    } else {
      throw new Error("Cloud Function returned an empty or invalid response.");
    }
  } catch (cfErr: any) {
    const cfErrMsg = cfErr instanceof Error ? cfErr.message : String(cfErr);
    console.error("Cloud Function verification failed:", cfErr);
    
    // Check for common error signatures
    if (cfErrMsg.includes("CORS") || cfErrMsg.includes("Access-Control-Allow-Origin") || cfErrMsg.includes("Failed to fetch")) {
      throw new Error("Cloud Function CORS blocked");
    }
    if (cfErrMsg.includes("not-found") || cfErrMsg.includes("not found") || cfErrMsg.includes("404")) {
      throw new Error("Cloud Function not deployed");
    }
    if (cfErrMsg.toLowerCase().includes("permission-denied") || cfErrMsg.toLowerCase().includes("permission denied")) {
      throw new Error("Permission denied");
    }
    if (cfErrMsg.toLowerCase().includes("app check") || cfErrMsg.toLowerCase().includes("appcheck")) {
      throw new Error("App Check initialization failed");
    }
    throw new Error(`reCAPTCHA verification failed: ${cfErrMsg}`);
  }
}
