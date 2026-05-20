import { Cashfree, CFEnvironment } from "cashfree-pg";
import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Initialize Firebase Admin (aligning with backend/server.ts)
const configPath = path.resolve("firebase-applet-config.json");
let firebaseConfig;
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.error("[DEBUG] Error loading firebase-applet-config.json inside verification utility:", e.message);
}

if (admin.apps.length === 0 && firebaseConfig) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("[DEBUG] Firebase Admin initialized inside verify-cashfree.js");
  } catch (e) {
    console.error("[DEBUG] Firebase Admin init failed inside verify-cashfree.js:", e.message);
  }
}

const getCashfreeConfig = async () => {
  // Use environment variables as standard/fallback defaults
  let appId = process.env.CASHFREE_APP_ID;
  let secretKey = process.env.CASHFREE_SECRET_KEY;
  let environment = process.env.CASHFREE_ENVIRONMENT === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";

  console.log("[DEBUG-VERIFY] Initial environment-based credentials check:", {
    appId: appId ? `${appId.substring(0, 4)}... (from env)` : "not set",
    hasSecret: !!secretKey,
    environment
  });

  // Try parsing the local setting-cache file
  try {
    const cachePath = path.resolve("settings-cache.json");
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      const cashfree = cacheData?.paymentGateways?.cashfree;
      if (cashfree) {
        console.log("[DEBUG-VERIFY] Found Cashfree gateway settings in settings-cache.json");
        if (cashfree.appId) appId = cashfree.appId;
        if (cashfree.secretKey) secretKey = cashfree.secretKey;
        if (cashfree.mode) environment = cashfree.mode === "production" ? "PRODUCTION" : "SANDBOX";
      }
    }
  } catch (err) {
    console.warn("[DEBUG-VERIFY] Error reading local settings-cache.json:", err.message);
  }

  // Fallback to fetch directly from Firestore settings document for dynamic update safety
  if (firebaseConfig) {
    try {
      console.log("[DEBUG-VERIFY] Fetching latest settings from Firestore database:", firebaseConfig.firestoreDatabaseId);
      const db = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");
      const docRef = db.collection("system").doc("settings");
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const cashfree = data?.paymentGateways?.cashfree;
        if (cashfree) {
          console.log("[DEBUG-VERIFY] Loaded latest Cashfree config from Firestore settings document:", {
            appId: cashfree.appId ? `${cashfree.appId.substring(0, 4)}... (from firestore)` : "not set",
            hasSecret: !!cashfree.secretKey,
            mode: cashfree.mode
          });
          if (cashfree.appId) appId = cashfree.appId;
          if (cashfree.secretKey) secretKey = cashfree.secretKey;
          if (cashfree.mode) environment = cashfree.mode === "production" ? "PRODUCTION" : "SANDBOX";
        } else {
          console.warn("[DEBUG-VERIFY] Firestore settings exists but paymentGateways.cashfree is not defined");
        }
      } else {
        console.warn("[DEBUG-VERIFY] system/settings document snapshot does not exist in Firestore");
      }
    } catch (err) {
      console.error("[DEBUG-VERIFY] Error fetching settings directly from Firestore:", err.message);
    }
  }

  return { appId, secretKey, environment };
};

export const handler = async (event, context) => {
  const orderId = event.queryStringParameters ? event.queryStringParameters.orderId : null;

  if (!orderId) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: "Order ID is required to fetch payments" }) 
    };
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
      
      return {
        statusCode: 200,
        body: JSON.stringify(response.data),
      };
    } catch (cfError) {
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
  } catch (error) {
    console.error("[ERROR] PGOrderFetchPayments lambda execution crashed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to verify payment with Cashfree", 
        message: error.message 
      }),
    };
  }
};
