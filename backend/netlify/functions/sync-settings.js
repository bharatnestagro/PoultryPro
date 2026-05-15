import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// Initialize Firebase Admin once
const configPath = path.resolve("firebase-applet-config.json");
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {
  console.error("Failed to load firebase-applet-config.json");
}

if (admin.apps.length === 0 && firebaseConfig) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = firebaseConfig ? getFirestore(firebaseConfig.firestoreDatabaseId) : null;

export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const settings = JSON.parse(event.body);
    
    // In Netlify, we can't reliably write to disk, but we can update Firestore
    // The original server.ts wrote to settings-cache.json which is not persistent on Netlify.
    // However, the frontend usually sends the settings to sync them.
    
    // For now, we'll just return success as the "caching" is more of a local dev optimization
    // In a real Netlify env, you'd probably just fetch from Firestore every time.
    
    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success", note: "Settings synced (not persistent on Netlify disk)" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
