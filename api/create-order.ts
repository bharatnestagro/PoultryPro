import { Cashfree, CFEnvironment } from "cashfree-pg";
import Razorpay from "razorpay";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Initialize Firebase Admin (aligning with backend/server.ts)
const configPath = path.resolve("firebase-applet-config.json");
let firebaseConfig: any;
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e: any) {
  console.error("[DEBUG] Error loading firebase-applet-config.json inside api create-order:", e.message);
}

if (admin.apps.length === 0 && firebaseConfig) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("[DEBUG] Firebase Admin initialized inside api/create-order.ts");
  } catch (e: any) {
    console.error("[DEBUG] Firebase Admin init failed inside api/create-order.ts:", e.message);
  }
}

const getCashfreeConfig = async () => {
  // Read Vercel/Standard Environment parameters first
  let appId = process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID;
  let secretKey = process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY;
  let environment = process.env.CASHFREE_ENVIRONMENT === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";

  console.log("[DEBUG] Initial environment-based credentials check inside API:", {
    appId: appId ? `${appId.substring(0, 4)}...` : "not set",
    hasSecret: !!secretKey,
    environment
  });

  // Try parsing local settings-cache.json
  try {
    const cachePath = path.resolve("settings-cache.json");
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      const cashfree = cacheData?.paymentGateways?.cashfree;
      if (cashfree) {
        console.log("[DEBUG] Found Cashfree gateway settings in settings-cache.json");
        if (cashfree.appId) appId = cashfree.appId;
        if (cashfree.secretKey) secretKey = cashfree.secretKey;
        if (cashfree.mode) environment = cashfree.mode === "production" ? "PRODUCTION" : "SANDBOX";
      }
    }
  } catch (err: any) {
    console.warn("[DEBUG] Error reading local settings-cache.json:", err.message);
  }

  // Fallback to fetch directly from Firestore settings document for dynamic update safety
  if (firebaseConfig) {
    try {
      console.log("[DEBUG] Fetching latest settings from Firestore database:", firebaseConfig.firestoreDatabaseId);
      const db = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");
      const docRef = db.collection("system").doc("settings");
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const cashfree = data?.paymentGateways?.cashfree;
        if (cashfree) {
          console.log("[DEBUG] Loaded latest Cashfree config from Firestore settings document:", {
            appId: cashfree.appId ? `${cashfree.appId.substring(0, 4)}... (from firestore)` : "not set",
            hasSecret: !!cashfree.secretKey,
            mode: cashfree.mode
          });
          if (cashfree.appId) appId = cashfree.appId;
          if (cashfree.secretKey) secretKey = cashfree.secretKey;
          if (cashfree.mode) environment = cashfree.mode === "production" ? "PRODUCTION" : "SANDBOX";
        } else {
          console.warn("[DEBUG] Firestore settings exists but paymentGateways.cashfree is not defined");
        }
      } else {
        console.warn("[DEBUG] system/settings document snapshot does not exist in Firestore");
      }
    } catch (err: any) {
      console.error("[DEBUG] Error fetching settings directly from Firestore:", err.message);
    }
  }

  return { appId, secretKey, environment };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const { amount, customerId, customerPhone, customerEmail, gateway, orderId } = body;
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount value specified" });
    }

    const finalOrderId = orderId || `order_${Date.now()}`;
    console.log(`[DEBUG] Creating ${gateway} order: ${finalOrderId} for amount: ${amount}`);

    if (gateway === "cashfree") {
      const config = await getCashfreeConfig();
      if (!config.appId || !config.secretKey) {
        throw new Error("Cashfree credentials are not configured in Admin Settings or System Environment");
      }

      // Initialize the correct Cashfree SDK instance (v5 class-based SDK)
      const isProductionMode = config.environment === "PRODUCTION";
      const cashfreeApp = new Cashfree(
        isProductionMode ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
        config.appId,
        config.secretKey
      );
      
      // Explicitly set the supported API version
      cashfreeApp.XApiVersion = "2023-08-01";

      // Formulate optimal request details
      const requestPayload = {
        order_id: finalOrderId,
        order_amount: parseFloat(parseFloat(amount).toFixed(2)),
        order_currency: "INR",
        customer_details: {
          customer_id: String(customerId || `cust_${Date.now()}`),
          customer_phone: String(customerPhone || "9999999999").replace(/\D/g, "").slice(-10) || "9999999999",
          customer_email: customerEmail || "customer@example.com",
          customer_name: "Customer"
        },
        order_meta: {
          return_url: `${String(req.headers.origin || "https://example.com")}/transactions?order_id={order_id}`
        }
      };

      console.log("[DEBUG] Cashfree payment creation request payload:", JSON.stringify(requestPayload, null, 2));
      
      try {
        // v5 signature is: PGCreateOrder(CreateOrderRequest, x_request_id?, x_idempotency_key?, options?)
        const response = await cashfreeApp.PGCreateOrder(requestPayload);
        console.log("[DEBUG] Cashfree API response data successfully received:", JSON.stringify(response.data, null, 2));

        return res.status(200).json(response.data);
      } catch (cfError: any) {
        console.error("[ERROR] Cashfree API Direct Call Failure:");
        if (cfError.response) {
          console.error("[ERROR] Status Code:", cfError.response.status);
          console.error("[ERROR] Error Response Data:", JSON.stringify(cfError.response.data, null, 2));
          throw new Error(`Cashfree error [${cfError.response.status}]: ${JSON.stringify(cfError.response.data)}`);
        } else {
          console.error("[ERROR] Error Message:", cfError.message);
          throw cfError;
        }
      }
    } 
    
    if (gateway === "payu") {
      const merchantKey = process.env.PAYU_MERCHANT_KEY;
      const salt = process.env.PAYU_SALT;
      
      if (!merchantKey || !salt) {
        throw new Error("PayU credentials not configured in environment");
      }

      const txnid = finalOrderId;
      const productinfo = "Payment for order " + txnid;
      const firstname = "Customer";
      const email = customerEmail || "customer@example.com";
      
      // Hash sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
      const hashString = `${merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      return res.status(200).json({
        hash,
        merchantKey,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        action: process.env.PAYU_ENVIRONMENT === "PRODUCTION" 
          ? "https://secure.payu.in/_payment" 
          : "https://test.payu.in/_payment"
      });
    }

    if (gateway === "razorpay") {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        throw new Error("Razorpay credentials not configured in environment");
      }

      const instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const options = {
        amount: Math.round(parseFloat(amount) * 100),
        currency: "INR",
        receipt: finalOrderId,
      };

      const order = await instance.orders.create(options);
      return res.status(200).json(order);
    }

    return res.status(400).json({ error: "Invalid or missing gateway specified. Options: cashfree, payu, razorpay" });

  } catch (error: any) {
    console.error("[ERROR] Order Creation Failed inside api lambda:", error);
    return res.status(500).json({ 
      error: "Failed to create order", 
      message: error.message,
      details: error.response?.data || null
    });
  }
}
