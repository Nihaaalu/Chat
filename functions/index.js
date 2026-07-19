const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { RecaptchaEnterpriseServiceClient } = require("@google-cloud/recaptcha-enterprise");

// Risk score thresholds for each protected action
const THRESHOLDS = {
  PRIVATE_LOGIN: 0.7,
  CREATE_ROOM: 0.7,
  JOIN_ROOM: 0.7,
  SEND_MESSAGE: 0.5,
  REACTION: 0.4,
  SEARCH: 0.3,
  NEXT_CHAT: 0.5,
  RANDOM_QUEUE: 0.6,
};

/**
 * Production-ready Firebase Callable Cloud Function for reCAPTCHA Enterprise verification.
 * 
 * Verifies token validity, matches action name, compares risk score with safety thresholds, 
 * and returns allow/deny evaluation results.
 */
exports.verifyRecaptcha = onCall(async (request) => {
  const data = request.data || {};
  const { token, action } = data;

  if (!token) {
    throw new HttpsError("invalid-argument", "reCAPTCHA token is required.");
  }
  if (!action) {
    throw new HttpsError("invalid-argument", "reCAPTCHA action name is required.");
  }

  // Retrieve current active GCP Project ID
  const projectId = process.env.GCLOUD_PROJECT || "ruby-random-chat-app";
  const siteKey = "6LcV9FotAAAAAG-WC6mATFYjJMTOfoFmT76oRaa0";

  // Instantiate the reCAPTCHA Enterprise client
  const client = new RecaptchaEnterpriseServiceClient();
  const projectPath = client.projectPath(projectId);

  try {
    // Perform assessment request
    const [assessment] = await client.createAssessment({
      parent: projectPath,
      assessment: {
        event: {
          token: token,
          siteKey: siteKey,
          expectedAction: action,
        },
      },
    });

    // 1. Verify token properties are returned
    if (!assessment.tokenProperties) {
      return {
        success: false,
        error: "NO_TOKEN_PROPERTIES",
        details: "No token properties received from reCAPTCHA assessment.",
      };
    }

    // 2. Verify token validity (e.g. check for expiration or duplicate usage)
    if (!assessment.tokenProperties.valid) {
      return {
        success: false,
        error: "INVALID_TOKEN",
        details: assessment.tokenProperties.invalidReason || "Token is invalid.",
      };
    }

    // 3. Prevent action name spoofing / injection attacks
    if (assessment.tokenProperties.action !== action) {
      return {
        success: false,
        error: "ACTION_MISMATCH",
        details: `Action mismatch: expected '${action}', got '${assessment.tokenProperties.action}'`,
      };
    }

    // 4. Compare assessment risk score against security threshold
    const score = assessment.riskAnalysis ? (assessment.riskAnalysis.score ?? 0) : 0;
    const threshold = 0.3;

    if (score < threshold) {
      return {
        success: false,
        error: "LOW_RISK_SCORE",
        score,
        threshold,
        details: `Risk score ${score} is below threshold ${threshold} for action '${action}'`,
      };
    }

    // Successful security verification
    return {
      success: true,
      score,
      action,
    };
  } catch (err) {
    console.error("reCAPTCHA Enterprise assessment failed:", err);
    throw new HttpsError("internal", `reCAPTCHA assessment service failed: ${err.message || err}`);
  }
});
