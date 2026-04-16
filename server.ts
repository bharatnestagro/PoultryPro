import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
