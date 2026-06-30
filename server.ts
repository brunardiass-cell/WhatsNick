import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import sosEmailHandler from "./api/sos/email";
import attentionEmailHandler from "./api/attention/email";
import attentionPushHandler from "./api/attention/push";
import messagesPushHandler from "./api/messages/push";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // SOS Email Endpoint
  app.post("/api/sos/email", async (req, res) => {
    console.log("API SOS chamada");
    return sosEmailHandler(req, res);
  });

  // Attention Email Endpoint
  app.post("/api/attention/email", async (req, res) => {
    console.log("API Attention chamada");
    return attentionEmailHandler(req, res);
  });

  // Attention Push Endpoint
  app.post("/api/attention/push", async (req, res) => {
    console.log("API Attention Push chamada");
    return attentionPushHandler(req, res);
  });

  // Messages Push Endpoint
  app.post("/api/messages/push", async (req, res) => {
    console.log("API Messages Push chamada");
    return messagesPushHandler(req, res);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // Prevent serving index.html for missing assets or api routes
      if (req.path.startsWith('/assets/') || req.path.startsWith('/api/')) {
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
