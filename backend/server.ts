import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios";
import fs from "fs";
import Razorpay from "razorpay";
import { Cashfree, CFEnvironment } from "cashfree-pg";

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

  // Diagnostic health check (VERY EARLY)
  const startTime = new Date();
  app.get("/api/health", (req, res) => {
    console.log("Health check hit - Version 1.1.0");
    res.json({ 
      status: "ok", 
      version: "1.1.0",
      uptime: Math.floor((new Date().getTime() - startTime.getTime()) / 1000) + "s",
      has_settings: !!_cachedSettings,
      env: process.env.NODE_ENV,
      is_prod: IS_PROD,
      cwd: process.cwd(),
      time: new Date().toISOString()
    });
  });

  // Vercel Serverless Function Emulation for Local Development
  app.all("/api/:functionName", async (req, res, next) => {
    const { functionName } = req.params;
    
    // Explicit exclusions for standard backend-configured Express routes
    if (["health", "admin", "create-razorpay-order", "create-cashfree-session", "verify-cashfree-payment"].includes(functionName)) {
      return next();
    }
    
    console.log(`[Vercel Emulation] Intercepting local request to Vercel API route: /api/${functionName}`);
    try {
      let handlerPath = path.resolve(process.cwd(), "api", `${functionName}.ts`);
      if (!fs.existsSync(handlerPath)) {
        handlerPath = path.resolve(process.cwd(), "api", `${functionName}.js`);
      }
      
      if (!fs.existsSync(handlerPath)) {
        console.warn(`[Vercel Emulation] Handler file not found for route: /api/${functionName}`);
        return next();
      }
      
      const module = await import(handlerPath);
      const handler = module.default;
      if (typeof handler === "function") {
        await handler(req, res);
      } else {
        res.status(500).json({ error: "Invalid Vercel API function: Default export not a function" });
      }
    } catch (error: any) {
      console.error(`[Vercel Emulation Error] Failed to execute /api/${functionName}:`, error);
      res.status(500).json({ error: "Local emulation of serverless route failed", message: error.message });
    }
  });

  // API Routes directly on app for maximum visibility
  // Sync settings from client
  app.post("/api/sync-settings", async (req, res) => {
    console.log("Sync settings request received");
    try {
      const settings = req.body;
      _cachedSettings = settings;
      fs.writeFileSync(path.join(process.cwd(), 'settings-cache.json'), JSON.stringify(settings, null, 2));
      res.json({ status: "success" });
    } catch (error: any) {
      console.error("Sync settings failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Razorpay Order Creation
  app.post("/api/create-razorpay-order", async (req, res) => {
    console.log("Razorpay order creation request received");
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

      const settings = await getSystemSettings();
      if (!settings) {
        return res.status(404).json({ error: "System settings not found" });
      }

      const cashfreeConfig = settings?.paymentGateways?.cashfree;
      if (!cashfreeConfig?.enabled || !cashfreeConfig?.appId || !cashfreeConfig?.secretKey) {
        return res.status(400).json({ error: "Cashfree is not properly configured" });
      }

      console.log(`Creating Cashfree session in ${cashfreeConfig.mode} mode using SDK v5...`);

      const isProduction = cashfreeConfig.mode === "production";
      const cashfreeApp = new Cashfree(
        isProduction ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
        cashfreeConfig.appId,
        cashfreeConfig.secretKey
      );

      cashfreeApp.XApiVersion = "2023-08-01";

      const requestPayload = {
        order_id: orderId || `order_${Date.now()}`,
        order_amount: parseFloat(parseFloat(amount).toFixed(2)),
        order_currency: "INR",
        customer_details: {
          customer_id: String(customerId || `cust_${Date.now()}`),
          customer_phone: String(customerPhone || "9999999999").replace(/\D/g, "").slice(-10) || "9999999999",
          customer_email: customerEmail || "customer@example.com",
          customer_name: "Customer"
        },
        order_meta: {
          return_url: `${req.headers.origin}/transactions?order_id={order_id}`
        }
      };

      console.log("[SERVER DEBUG] Cashfree Payload:", JSON.stringify(requestPayload, null, 2));
      const response = await cashfreeApp.PGCreateOrder(requestPayload);
      console.log("[SERVER DEBUG] Cashfree Response Data:", JSON.stringify(response.data, null, 2));

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

      console.log(`Verifying Cashfree payment logs for order ${orderId}...`);

      const isProduction = cashfreeConfig.mode === "production";
      const cashfreeApp = new Cashfree(
        isProduction ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
        cashfreeConfig.appId,
        cashfreeConfig.secretKey
      );

      cashfreeApp.XApiVersion = "2023-08-01";

      const response = await cashfreeApp.PGOrderFetchPayments(orderId);
      console.log(`[SERVER DEBUG] Cashfree Payments response retrieved:`, JSON.stringify(response.data, null, 2));

      res.json(response.data);
    } catch (error: any) {
      console.error("Verification Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to verify payment",
        details: error.response?.data || error.message
      });
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

  // Catch-all for API routes (DEBUG VERSION)
  app.all("/api/*", (req, res) => {
    const errorMsg = `API Route not found: ${req.method} ${req.url}`;
    console.warn(errorMsg);
    res.status(404).json({ 
      error: errorMsg,
      server_time: new Date().toISOString(),
      is_prod: IS_PROD,
      registered_routes: [
        "/api/health",
        "/api/sync-settings",
        "/api/create-razorpay-order",
        "/api/create-cashfree-session",
        "/api/verify-cashfree-payment/:orderId",
        "/api/admin/stats"
      ]
    });
  });

  // Vite/Static handling
  if (!IS_PROD) {
    console.log("Entering development mode with Vite middleware...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: path.join(process.cwd(), "frontend"), // Updated root to frontend
      });
      app.use(vite.middlewares);
    } catch (e: any) {
      console.error("Failed to start Vite middleware:", e.message);
    }
  } else {
    console.log("Entering production mode...");
    const distPath = path.join(process.cwd(), "frontend/dist");
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
