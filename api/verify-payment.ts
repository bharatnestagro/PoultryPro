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
  console.error("[DEBUG] Error loading firebase-applet-config.json inside api verify-payment:", e.message);
}

if (admin.apps.length === 0 && firebaseConfig) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  } catch (e: any) {
    console.error("[DEBUG] Firebase Admin init failed:", e.message);
  }
}

const getRazorpayConfig = async () => {
  let keyId = process.env.RAZORPAY_KEY_ID;
  let keySecret = process.env.RAZORPAY_KEY_SECRET;

  try {
    const cachePath = path.resolve("settings-cache.json");
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      const rzp = cacheData?.paymentGateways?.razorpay;
      if (rzp) {
        if (rzp.apiKey) keyId = rzp.apiKey;
        if (rzp.apiSecret) keySecret = rzp.apiSecret;
      }
    }
  } catch (err: any) {
    console.warn("[DEBUG] Error reading settings-cache:", err.message);
  }

  if ((!keyId || !keySecret) && firebaseConfig) {
    try {
      const db = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");
      const docRef = db.collection("system").doc("settings");
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const rzp = data?.paymentGateways?.razorpay;
        if (rzp) {
          if (rzp.apiKey) keyId = rzp.apiKey;
          if (rzp.apiSecret) keySecret = rzp.apiSecret;
        }
      }
    } catch (err: any) {
      console.error("[DEBUG] Error fetching settings from Firestore:", err.message);
    }
  }

  return { keyId, keySecret };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required verification fields" });
    }

    const { keySecret } = await getRazorpayConfig();

    if (!keySecret) {
      return res.status(401).json({ error: "Razorpay apiSecret is not configured" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      return res.status(200).json({ success: true, status: "success" });
    } else {
      return res.status(400).json({ success: false, error: "Signature mismatch" });
    }
  } catch (error: any) {
    console.error("[ERROR] Razorpay Payment Verification Failed:", error);
    return res.status(500).json({ error: "Verification Failed", message: error.message });
  }
}
