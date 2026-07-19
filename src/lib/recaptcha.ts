declare global {
  interface Window {
    grecaptcha: any;
  }
}

const SITE_KEY = "6LcV9FotAAAAAG-WC6mATFYjJMTOfoFmT76oRaa0";

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
 * Helper to execute reCAPTCHA Enterprise and immediately verify it against the backend.
 * Throws a friendly error message if verification fails.
 */
export async function runVerification(action: string): Promise<void> {
  let token: string;
  try {
    token = await executeRecaptcha(action);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Security check failed to initialize: ${errMsg}`);
  }

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
