import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Initialize Firebase Admin once
const configPath = path.resolve("firebase-applet-config.json");
let firebaseConfig: any;
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (e: any) {
  console.error("Failed to load firebase-applet-config.json");
}

if (admin.apps.length === 0 && firebaseConfig) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = firebaseConfig ? getFirestore(firebaseConfig.firestoreDatabaseId || "(default)") : null;

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
    const settings = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    
    // In serverless, we can't reliably write to disk, but we can return success
    return res.status(200).json({ status: "success", note: "Settings synced (not persistent on serverless disk)" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
