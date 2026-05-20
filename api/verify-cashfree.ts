import { Cashfree, CFEnvironment } from "cashfree-pg";
import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Initialize Firebase Admin (aligning with backend/server.ts)
const configPath = path.resolve("firebase-applet-config.json");
let firebaseConfig: any;
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e: any) {
  console.error("[DEBUG] Error loading firebase-applet-config.json inside api verification:", e.message);
}

if (admin.apps.length === 0 && firebaseConfig) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("[DEBUG] Firebase Admin initialized inside api/verify-cashfree.ts");
  } catch (e: any) {
    console.error("[DEBUG] Firebase Admin init failed inside api/verify-cashfree.ts:", e.message);
  }
}

const getCashfreeConfig = async () => {
  // Read Vercel/Standard Environment parameters first
  let appId = process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID;
  let secretKey = process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY;
  let rawMode = process.env.CASHFREE_ENVIRONMENT || process.env.CASHFREE_MODE || "SANDBOX";
  let configSource = "Process Environment Variables";

  // Try parsing the local settings-cache file
  try {
    const cachePath = path.resolve("settings-cache.json");
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      const cashfree = cacheData?.paymentGateways?.cashfree;
      if (cashfree) {
        if (cashfree.appId) appId = cashfree.appId;
        if (cashfree.secretKey) secretKey = cashfree.secretKey;
        if (cashfree.mode) {
          rawMode = cashfree.mode;
          configSource = "Local Cache (settings-cache.json)";
        }
      }
    }
  } catch (err: any) {
    console.warn("[DEBUG-VERIFY] Error reading local settings-cache.json:", err.message);
  }

  // Fallback to fetch directly from Firestore settings document for dynamic update safety
  if (firebaseConfig) {
    try {
      const db = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");
      const docRef = db.collection("system").doc("settings");
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const cashfree = data?.paymentGateways?.cashfree;
        if (cashfree) {
          if (cashfree.appId) appId = cashfree.appId;
          if (cashfree.secretKey) secretKey = cashfree.secretKey;
          if (cashfree.mode) {
            rawMode = cashfree.mode;
            configSource = "Firestore (system/settings document)";
          }
        }
      }
    } catch (err: any) {
      console.error("[DEBUG-VERIFY] Error fetching settings directly from Firestore:", err.message);
    }
  }

  // Normalize Environment Mode securely
  const modeNormalized = String(rawMode || "SANDBOX").toLowerCase();
  const environment = (modeNormalized === "production" || modeNormalized === "live") ? "PRODUCTION" : "SANDBOX";
  const sdkEndpoint = environment === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

  console.log("[CASHFREE CONFIG RESOLVED] Details:", {
    selectedMode: environment,
    partialAppId: appId ? `${appId.substring(0, Math.min(6, appId.length))}...` : "not set",
    hasSecretKey: !!secretKey,
    environmentSource: configSource,
    endpointUsed: sdkEndpoint
  });

  return { appId, secretKey, environment, sdkEndpoint };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  let orderId = req.query ? (req.query.orderId as string) : null;

  // Fallback to manually parse url if req.query is not present
  if (!orderId && req.url) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      orderId = urlObj.searchParams.get("orderId");
    } catch (e: any) {
      console.error("Url parsing failed in verification API parameter retrieval:", e);
    }
  }

  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required to fetch payments" });
  }

  try {
    const config = await getCashfreeConfig();
    if (!config.appId || !config.secretKey) {
      throw new Error("Cashfree credentials are not configured in Admin Settings or System Environment");
    }

    const isProductionMode = config.environment === "PRODUCTION";
    const cashfreeApp = new Cashfree(
      isProductionMode ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
      config.appId,
      config.secretKey
    );

    cashfreeApp.XApiVersion = "2023-08-01";

    console.log(`[DEBUG-VERIFY] Attempting payload lookup with Cashfree for order ID: ${orderId}`);
    
    try {
      const response = await cashfreeApp.PGOrderFetchPayments(orderId);
      console.log(`[DEBUG-VERIFY] Successfully retrieved Cashfree payment logs for order ${orderId}`);
      
      return res.status(200).json(response.data);
    } catch (cfError: any) {
      console.error(`[ERROR-VERIFY] Cashfree Fetch Failure for order ${orderId}:`);
      if (cfError.response) {
        console.error("[ERROR-VERIFY] Status Code:", cfError.response.status);
        console.error("[ERROR-VERIFY] Response Data:", JSON.stringify(cfError.response.data, null, 2));
        throw new Error(`Cashfree Verification Error [${cfError.response.status}]: ${JSON.stringify(cfError.response.data)}`);
      } else {
        console.error("[ERROR-VERIFY] Message:", cfError.message);
        throw cfError;
      }
    }
  } catch (error: any) {
    console.error("[ERROR] PGOrderFetchPayments API execution crashed:", error);
    return res.status(500).json({ 
      error: "Failed to verify payment with Cashfree", 
      message: error.message 
    });
  }
}
