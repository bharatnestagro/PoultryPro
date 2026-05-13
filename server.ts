import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios";
import fs from "fs";
import Razorpay from "razorpay";

console.log("Starting server initialization...");

// Use process.env.NODE_ENV or fallback to production if we're in the dist folder
const IS_PROD = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), 'dist/index.html'));

let __filename: string;
let __dirname: string;

try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // Fallback for CJS bundle where import.meta is not available
  __filename = (global as any).__filename || "";
  __dirname = (global as any).__dirname || process.cwd();
}

// Initialize Firebase Admin
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
console.log("Loading config from:", configPath);

let firebaseConfig: any;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e: any) {
  console.error("CRITICAL: Failed to load firebase-applet-config.json:", e.message);
  process.exit(1);
}

if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("Firebase Admin initialized successfully");
  } catch (e: any) {
    console.error("Firebase Admin init failed:", e.message);
  }
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
      console.log("Settings loaded from disc cache");
      return data;
    }
  } catch (e) {
    // Expected if doesn't exist
  }

  const debug: any = { source: "admin_sdk" };
  try {
    console.log("Fetching settings from Firestore...");
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
      console.log("Attempting REST API fallback for settings...");
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
      console.error("REST API Fallback also failed.");
      
      // If we have nothing, throw a helpful error
      throw new Error(JSON.stringify(debug));
    }
  }
}

async function startServer() {
  console.log("Initializing Express app...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      has_settings: !!_cachedSettings,
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  // Sync settings from client
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
      const razorpayConfig = settings?.paymentGateways?.razorpay;
      
      if (!razorpayConfig?.enabled || !razorpayConfig?.apiKey || !razorpayConfig?.apiSecret) {
        return res.status(400).json({ error: "Razorpay is not properly configured" });
      }

      const instance = new Razorpay({
        key_id: razorpayConfig.apiKey,
        key_secret: razorpayConfig.apiSecret,
      });

      const options = {
        amount: Math.round(amount * 100),
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
    console.log("Request to /api/create-cashfree-session received");
    try {
      const { amount, customerId, customerPhone, customerEmail, orderId } = req.body;

      let settings;
      try {
        settings = await getSystemSettings();
      } catch (e: any) {
        console.error("Settings fetch failed in Cashfree session creation:", e.message);
      }
      
      if (!settings) {
        return res.status(404).json({ error: "System settings not found or inaccessible" });
      }

      const cashfreeConfig = settings?.paymentGateways?.cashfree;

      if (!cashfreeConfig?.enabled || !cashfreeConfig?.appId || !cashfreeConfig?.secretKey) {
        return res.status(400).json({ error: "Cashfree is not properly configured" });
      }

      const isProduction = cashfreeConfig.mode === "production";
      const cashfreeUrl = isProduction 
        ? "https://api.cashfree.com/pg/orders" 
        : "https://sandbox.cashfree.com/pg/orders";

      console.log(`Creating Cashfree session in ${cashfreeConfig.mode} mode...`);

      const payload = {
        order_id: orderId || `order_${Date.now()}`,
        order_amount: parseFloat(amount),
        order_currency: "INR",
        customer_details: {
          customer_id: String(customerId || `cust_${Date.now()}`),
          customer_phone: String(customerPhone || "9999999999"),
          customer_email: customerEmail || "customer@example.com",
          customer_name: "Customer"
        },
        order_meta: {
           return_url: `${req.headers.origin}/transactions`
        }
      };

      const response = await axios.post(
        cashfreeUrl,
        payload,
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

  // Stats API
  app.get("/api/admin/stats", (req, res) => {
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

  // Catch-all for API routes
  app.all("/api/*", (req, res) => {
    console.warn(`API Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite/Static handling
  if (!IS_PROD) {
    console.log("Entering development mode with Vite middleware...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e: any) {
      console.error("Failed to start Vite middleware:", e.message);
    }
  } else {
    console.log("Entering production mode...");
    const distPath = path.join(process.cwd(), "dist");
    console.log("Serving static files from:", distPath);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // Prevent infinite loop if index.html is missing
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Production build not found. Please run 'npm run build'.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Node Environment: ${process.env.NODE_ENV}`);
  });
}

try {
  startServer();
} catch (e: any) {
  console.error("FATAL: Failed to start server:", e.message);
}
