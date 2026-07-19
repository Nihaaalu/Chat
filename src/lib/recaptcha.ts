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
export async function runVerification(action: string): Promise<void> {
  // Client-side dev mode bypass as suggested
  if (import.meta.env.DEV) {
    console.log(`[Dev Bypass] Client bypassed reCAPTCHA for action: ${action}`);
    return;
  }

  let token: string;
  try {
    token = await executeRecaptcha(action);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Security check failed to initialize: ${errMsg}`);
  }

  // Production: Try calling the Firebase Cloud Function first
  if (verifyRecaptchaFn) {
    try {
      const response: any = await verifyRecaptchaFn({ token, action });
      const data = response.data;
      if (data && typeof data === "object") {
        if (!data.success) {
          throw new Error(data.details || data.error || "reCAPTCHA validation rejected.");
        }
        return; // Success! Authorized via Firebase Cloud Function
      }
    } catch (cfErr: any) {
      console.warn("Cloud Function verification failed or not deployed, falling back to local Express proxy:", cfErr);
      // Fallback to Express proxy in development environment so the preview doesn't break
    }
  }

  // Local/Fallback: Verify against local Express proxy
  const response = await fetch("/api/verify-recaptcha", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, action }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const reason = result.error || "low trust verification failed";
    throw new Error(`Security validation rejected: ${reason}`);
  }
}
