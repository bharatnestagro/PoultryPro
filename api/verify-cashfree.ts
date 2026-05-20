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

  // For sandbox testing mode override as requested:
  // "1. Keep the application in SANDBOX mode for testing."
  // "2. Ensure backend uses: CFEnvironment.SANDBOX"
  // "3. Ensure Cashfree API endpoint matches sandbox mode."
  // "4. Remove any forced production configuration."
  const environment = "SANDBOX";
  const sdkEndpoint = "https://sandbox.cashfree.com/pg";

  console.log("[CASHFREE CONFIG RESOLVED] Details:", {
    selectedMode: environment,
    requestedAdminMode: rawMode,
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
      let errorMessage = cfError.message || "Unknown Verification Error";
      let status = 500;
      let details = null;

      if (cfError.response) {
        status = cfError.response.status;
        details = cfError.response.data;
        console.error("[ERROR-VERIFY] Status Code:", status);
        console.error("[ERROR-VERIFY] Response Data:", JSON.stringify(details, null, 2));

        if (status === 401) {
          errorMessage = "Cashfree API 401 Authentication Failed during verification. Ensure you are using your SANDBOX credentials (Sandbox App ID and Sandbox Secret Key) when the app is in Sandbox mode, and that they have not been copied with leading/trailing spaces.";
        } else {
          errorMessage = `Cashfree Verification Error [${status}]: ${JSON.stringify(details)}`;
        }
      } else {
        console.error("[ERROR-VERIFY] Message:", cfError.message);
      }

      return res.status(status).json({
        error: "Cashfree Payment Verification Failure",
        message: errorMessage,
        details: details,
        debug: {
          environmentMode: "SANDBOX (testing)",
          partialAppId: config.appId ? `${config.appId.substring(0, Math.min(6, config.appId.length))}...` : "not set",
          endpointUsed: config.sdkEndpoint
        }
      });
    }
  } catch (error: any) {
    console.error("[ERROR] PGOrderFetchPayments API execution crashed:", error);
    return res.status(500).json({ 
      error: "Failed to verify payment with Cashfree", 
      message: error.message 
    });
  }
}
