import { Handler } from '@netlify/functions';
import axios from 'axios';
import Razorpay from 'razorpay';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Singleton-ish for serverless)
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    // If you have a service account JSON, you can set it in an env var
    // Or just use the project ID if you're running in an environment with implicit auth
    // For Netlify, you MUST provide credentials via env vars usually.
    // However, I will try to use the project ID from env if available.
    
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      // Fallback or development warning
      console.warn("Firebase Admin credentials not found in environment variables. Falling back to default credentials.");
      admin.initializeApp();
    }
  }
  // Return firestore with specific database ID if possible. 
  // User had firestoreDatabaseId in their config.
  const dbId = process.env.FIREBASE_DATABASE_ID || '(default)';
  return getFirestore(dbId);
};

const handler: Handler = async (event, context) => {
  console.log("Create Order Function triggered:", event.httpMethod, event.path);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { amount, currency = "INR", gateway = "cashfree", customerId, customerPhone, customerEmail, orderId } = body;

    if (!amount) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Amount is required" }) 
      };
    }

    const db = initializeFirebase();
    
    // Fetch settings from Firestore
    const settingsSnap = await db.collection('system').doc('settings').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    
    if (gateway === 'cashfree') {
      const config = settings?.paymentGateways?.cashfree || {};
      const appId = process.env.CASHFREE_APP_ID || config.appId;
      const secretKey = process.env.CASHFREE_SECRET_KEY || config.secretKey;
      const mode = process.env.CASHFREE_MODE || config.mode || 'sandbox';

      if (!appId || !secretKey) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ error: "Cashfree is not properly configured" }) 
        };
      }

      const cashfreeUrl = mode === "production" 
        ? "https://api.cashfree.com/pg/orders" 
        : "https://sandbox.cashfree.com/pg/orders";

      const payload = {
        order_id: orderId || `order_${Date.now()}`,
        order_amount: parseFloat(amount),
        order_currency: currency,
        customer_details: {
          customer_id: String(customerId || `cust_${Date.now()}`),
          customer_phone: String(customerPhone || "9999999999"),
          customer_email: customerEmail || "customer@example.com",
          customer_name: "Customer"
        },
        order_meta: {
          return_url: `${event.headers.origin}/transactions?order_id={order_id}`
        }
      };

      console.log(`Creating Cashfree order in ${mode} mode...`);

      const response = await axios.post(
        cashfreeUrl,
        payload,
        {
          headers: {
            "x-client-id": appId,
            "x-client-secret": secretKey,
            "x-api-version": "2023-08-01",
            "Content-Type": "application/json",
          },
        }
      );

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response.data)
      };

    } else if (gateway === 'razorpay') {
      const config = settings?.paymentGateways?.razorpay || {};
      const apiKey = process.env.RAZORPAY_KEY_ID || config.apiKey;
      const apiSecret = process.env.RAZORPAY_KEY_SECRET || config.apiSecret;

      if (!apiKey || !apiSecret) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ error: "Razorpay is not properly configured" }) 
        };
      }

      const instance = new Razorpay({
        key_id: apiKey,
        key_secret: apiSecret,
      });

      const options = {
        amount: Math.round(amount * 100),
        currency,
        receipt: `receipt_${Date.now()}`,
      };

      const order = await instance.orders.create(options);
      
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order)
      };
    }

    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: "Invalid gateway" }) 
    };

  } catch (error: any) {
    console.error("Payment Function Error:", error.response?.data || error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Internal Server Error", 
        details: error.response?.data || error.message 
      })
    };
  }
};

export { handler };
