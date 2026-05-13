import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios";
import fs from "fs";
import Razorpay from "razorpay";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

// In AI Studio, we must use the database ID from the config
const db = getFirestore(firebaseConfig.firestoreDatabaseId);

let _cachedSettings: any = null;

async function getSystemSettings() {
  // Try memory cache first
  if (_cachedSettings) return _cachedSettings;

  // Try local disk cache
  try {
    const cachePath = path.join(process.cwd(), 'settings-cache.json');
    if (fs.existsSync(cachePath)) {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      _cachedSettings = data;
      return data;
    }
  } catch (e) {
    console.error("Cache read failed");
  }

  const debug: any = { source: "admin_sdk" };
  try {
    const settingsRef = db.collection('system').doc('settings');
    const settingsSnap = await settingsRef.get();
    
    if (settingsSnap.exists) {
      const data = settingsSnap.data();
      _cachedSettings = data;
      return data;
    } else {
      console.error("Settings document does not exist in Firestore");
      return null;
    }
  } catch (e: any) {
    debug.admin_error = e.message;
    debug.admin_code = e.code;
    console.warn("Admin SDK Firestore Read Failed (Expected in some environments):", e.message);
    
    // REST API Fallback
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId;
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/system/settings`;
      
      const res = await axios.get(url);
      const fields = res.data.fields;
      
      const unmarshal = (data: any): any => {
        if (!data) return null;
        if (data.mapValue) {
          const obj: any = {};
          if (data.mapValue.fields) {
            for (const k in data.mapValue.fields) {
              obj[k] = unmarshal(data.mapValue.fields[k]);
            }
          }
          return obj;
        }
        if (data.stringValue !== undefined) return data.stringValue;
        if (data.booleanValue !== undefined) return data.booleanValue;
        if (data.integerValue !== undefined) return parseInt(data.integerValue);
        if (data.doubleValue !== undefined) return parseFloat(data.doubleValue);
        if (data.arrayValue) return data.arrayValue.values?.map(unmarshal) || [];
        return null;
      };

      const result: any = {};
      for (const key in fields) {
        result[key] = unmarshal(fields[key]);
      }
      _cachedSettings = result;
      return result;
    } catch (restErr: any) {
      debug.rest_error = restErr.response?.data || restErr.message;
      debug.rest_status = restErr.response?.status;
      console.error("RESt API Fallback also failed.");
      
      // If we have nothing, throw a helpful error
      throw new Error(JSON.stringify(debug));
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      has_settings: !!_cachedSettings,
      env: process.env.NODE_ENV 
    });
  });

  // Sync settings from client (workaround for Firestore Admin permissions)
  app.post("/api/sync-settings", async (req, res) => {
    try {
      const settings = req.body;
      _cachedSettings = settings;
      fs.writeFileSync(path.join(process.cwd(), 'settings-cache.json'), JSON.stringify(settings, null, 2));
      console.log("System settings synced from client successfully");
      res.json({ status: "success" });
    } catch (error: any) {
      console.error("Sync settings failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Razorpay Order Creation
  app.post("/api/create-razorpay-order", async (req, res) => {
    try {
      const { amount, currency = "INR" } = req.body;

      const settings = await getSystemSettings();
      if (!settings) {
        return res.status(404).json({ error: "System settings not found" });
      }

      const razorpayConfig = settings?.paymentGateways?.razorpay;
      if (!razorpayConfig?.enabled || !razorpayConfig?.apiKey || !razorpayConfig?.apiSecret) {
        return res.status(400).json({ error: "Razorpay is not properly configured" });
      }

      const instance = new Razorpay({
        key_id: razorpayConfig.apiKey,
        key_secret: razorpayConfig.apiSecret,
      });

      const options = {
        amount: Math.round(amount * 100), // amount in the smallest currency unit
        currency,
        receipt: `receipt_${Date.now()}`,
      };

      const order = await instance.orders.create(options);
      res.json(order);
    } catch (error: any) {
      console.error("Razorpay Order Error:", error);
      res.status(500).json({ error: "Failed to create Razorpay order", details: error.message });
    }
  });

  // Cashfree Session Creation
  app.post("/api/create-cashfree-session", async (req, res) => {
    try {
      const { amount, customerId, customerPhone, customerEmail, orderId } = req.body;

      // 1. Get Cashfree keys using helper
      let settings;
      let debug_info: any = { status: "fetching" };
      try {
        settings = await getSystemSettings();
      } catch (e: any) {
        try {
          debug_info = JSON.parse(e.message);
        } catch (parseErr) {
          debug_info.raw_error = e.message;
        }
      }
      
      if (!settings) {
        return res.status(404).json({ 
          error: "System settings not found or inaccessible",
          debug: debug_info 
        });
      }

      const cashfreeConfig = settings?.paymentGateways?.cashfree;

      if (!cashfreeConfig?.enabled || !cashfreeConfig?.appId || !cashfreeConfig?.secretKey) {
        console.error("Cashfree configuration missing:", { 
          enabled: cashfreeConfig?.enabled, 
          hasAppId: !!cashfreeConfig?.appId, 
          hasSecret: !!cashfreeConfig?.secretKey 
        });
        return res.status(400).json({ error: "Cashfree is not properly configured" });
      }

      // 2. Call Cashfree API to create order/session
      // Using Cashfree V3 API: https://docs.cashfree.com/reference/pgcreateorder
      const isProduction = cashfreeConfig.mode === "production";
      const cashfreeUrl = isProduction 
        ? "https://api.cashfree.com/pg/orders" 
        : "https://sandbox.cashfree.com/pg/orders";

      console.log(`Creating Cashfree session in ${cashfreeConfig.mode} mode...`);

      const response = await axios.post(
        cashfreeUrl,
        {
          order_id: orderId || `order_${Date.now()}`,
          order_amount: parseFloat(amount),
          order_currency: "INR",
          customer_details: {
            customer_id: customerId,
            customer_phone: customerPhone,
            customer_email: customerEmail,
          },
          order_meta: {
             return_url: `${req.headers.origin}/transactions`
          }
        },
        {
          headers: {
            "x-client-id": cashfreeConfig.appId,
            "x-client-secret": cashfreeConfig.secretKey,
            "x-api-version": "2023-08-01",
            "Content-Type": "application/json",
          },
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error("Cashfree Session Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to create Cashfree session", 
        details: error.response?.data || error.message 
      });
    }
  });

  // Verify Cashfree Payment
  app.get("/api/verify-cashfree-payment/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;

      const settings = await getSystemSettings();
      if (!settings) {
        return res.status(404).json({ error: "System settings not found" });
      }
      
      const cashfreeConfig = settings?.paymentGateways?.cashfree;

      if (!cashfreeConfig?.appId || !cashfreeConfig?.secretKey) {
        return res.status(400).json({ error: "Cashfree not configured" });
      }

      const isProduction = cashfreeConfig.mode === "production";
      const cashfreeUrl = isProduction 
        ? `https://api.cashfree.com/pg/orders/${orderId}`
        : `https://sandbox.cashfree.com/pg/orders/${orderId}`;

      const response = await axios.get(
        cashfreeUrl,
        {
          headers: {
            "x-client-id": cashfreeConfig.appId,
            "x-client-secret": cashfreeConfig.secretKey,
            "x-api-version": "2023-08-01",
          }
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error("Verification Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // Admin stats API (mocking for now, will connect to Firestore later)
  app.get("/api/admin/stats", (req, res) => {
    // This would normally fetch from Firestore using Admin SDK or similar
    // But since we are client-side heavy with Firebase, we might just do it in the frontend
    // However, the user asked for a RESTful API structure.
    res.json({
      totalFarmers: 128,
      totalBirds: 15400,
      totalTransactions: 450,
      growthData: [
        { name: 'Jan', birds: 4000 },
        { name: 'Feb', birds: 3000 },
        { name: 'Mar', birds: 5000 },
        { name: 'Apr', birds: 4500 },
      ]
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
