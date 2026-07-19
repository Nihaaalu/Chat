import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// reCAPTCHA Action thresholds as requested by user
const THRESHOLDS: Record<string, number> = {
  PRIVATE_LOGIN: 0.7,
  CREATE_ROOM: 0.7,
  JOIN_ROOM: 0.7,
  RANDOM_QUEUE: 0.6,
  SEND_MESSAGE: 0.5,
  REACTION: 0.4,
  SEARCH: 0.3,
  NEXT_CHAT: 0.5,
};

/**
 * Robustly retrieves the Firebase/GCP API key from environment or config file.
 */
function getGcpApiKey(): string {
  // 1. Try VITE_FIREBASE_API_KEY env variable
  if (process.env.VITE_FIREBASE_API_KEY) {
    return process.env.VITE_FIREBASE_API_KEY;
  }
  // 2. Try FIREBASE_API_KEY env variable
  if (process.env.FIREBASE_API_KEY) {
    return process.env.FIREBASE_API_KEY;
  }
  // 3. Parse firebase-applet-config.json directly
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.apiKey) {
        return config.apiKey;
      }
    }
  } catch (err) {
    console.error("Failed to read apiKey from firebase-applet-config.json:", err);
  }

  throw new Error("GCP API Key (VITE_FIREBASE_API_KEY) could not be located in environment or config.");
}

/**
 * Verifies a token with the reCAPTCHA Enterprise API on Google Cloud.
 */
async function verifyRecaptchaToken(token: string, action: string) {
  const projectId = "ruby-random-chat-app";
  const siteKey = "6LcV9FotAAAAAG-WC6mATFYjJMTOfoFmT76oRaa0";
  const apiKey = getGcpApiKey();

  const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

  const payload = {
    event: {
      token: token,
      siteKey: siteKey,
      expectedAction: action,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`reCAPTCHA Enterprise API call failed: ${response.statusText} (${errorText})`);
  }

  return response.json();
}

// ---------------------- API ROUTES ----------------------

app.post("/api/verify-recaptcha", async (req, res) => {
  try {
    const { token, action } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "token is required" });
    }
    if (!action) {
      return res.status(400).json({ success: false, error: "action is required" });
    }

    const verification = await verifyRecaptchaToken(token, action);

    // 1. Reject invalid or expired tokens
    if (!verification.tokenProperties || !verification.tokenProperties.valid) {
      const reason = verification.tokenProperties?.invalidReason || "INVALID_REASON_UNSPECIFIED";
      const isExpired = reason.includes("EXPIRED");
      return res.status(400).json({
        success: false,
        error: isExpired ? "expired token" : "invalid token",
        details: reason,
      });
    }

    // 2. Reject action mismatch
    if (verification.tokenProperties.action !== action) {
      return res.status(400).json({
        success: false,
        error: "action mismatch",
        details: `Expected action ${action}, got ${verification.tokenProperties.action}`,
      });
    }

    // 3. Reject low risk scores based on action-specific threshold
    const score = verification.riskAnalysis?.score ?? 0;
    const threshold = THRESHOLDS[action] ?? 0.5;

    if (score < threshold) {
      return res.status(403).json({
        success: false,
        error: "low risk score",
        details: `Score ${score} is below threshold ${threshold} for ${action}`,
      });
    }

    return res.json({ success: true, score });
  } catch (error) {
    console.error("reCAPTCHA Enterprise verification error:", error);
    return res.status(500).json({
      success: false,
      error: "verification system error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// -------------------- VITE SERVING --------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
