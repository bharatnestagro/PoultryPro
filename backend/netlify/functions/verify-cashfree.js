import { Cashfree } from "cashfree-pg";
import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Initialize Firebase Admin
const configPath = path.resolve("firebase-applet-config.json");
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {}

if (admin.apps.length === 0 && firebaseConfig) {
  admin.initializeApp({ projectId: firebaseConfig.projectId });
}

export const handler = async (event, context) => {
  const orderId = event.queryStringParameters ? event.queryStringParameters.orderId : null;

  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Order ID is required" }) };
  }

  try {
    // In a real app, you'd fetch the Cashfree credentials from Firestore / env
    Cashfree.XClientId = process.env.CASHFREE_APP_ID;
    Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
    Cashfree.XEnvironment = process.env.CASHFREE_ENVIRONMENT === "PRODUCTION" ? Cashfree.Environment.PRODUCTION : Cashfree.Environment.SANDBOX;

    const response = await Cashfree.PGOrderFetchPayments("2023-08-01", orderId);
    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
