/**
 * reCAPTCHA Verification Bypass
 * All verification requirements have been deactivated as requested.
 */

export async function runVerification(action: string): Promise<any> {
  console.log(`[Bypass] Bypassing verification for action: ${action}`);
  return {
    success: true,
    score: 1.0,
    trusted: true,
    verified: true
  };
}
