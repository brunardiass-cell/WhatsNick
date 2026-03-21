import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // SOS Email Endpoint
  app.post("/api/sos/email", async (req, res) => {
    const { fromEmail, toEmail, senderName, location } = req.body;

    if (!fromEmail || !toEmail) {
      return res.status(400).json({ error: "Missing emails" });
    }

    try {
      // In a real production app, you'd use a real SMTP service like SendGrid, Resend, or Gmail OAuth
      // For this environment, we'll set up a transporter that logs or uses a test account
      let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false, 
        auth: {
          user: process.env.SMTP_USER || "test@ethereal.email",
          pass: process.env.SMTP_PASS || "testpass",
        },
      });

      const locationLink = location 
        ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
        : "Localização não disponível";

      const info = await transporter.sendMail({
        from: `"WhatsNick SOS" <${fromEmail}>`,
        to: toEmail,
        subject: `🚨 ALERTA SOS: ${senderName} precisa de ajuda!`,
        text: `${senderName} acionou um alerta SOS no WhatsNick! \n\nLocalização: ${locationLink}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 2px solid red; border-radius: 10px;">
            <h1 style="color: red;">🚨 ALERTA SOS</h1>
            <p><strong>${senderName}</strong> acionou um alerta SOS no WhatsNick!</p>
            <p><strong>Localização:</strong> <a href="${locationLink}">${locationLink}</a></p>
            <hr />
            <p style="font-size: 12px; color: #666;">Este é um alerta automático de segurança do WhatsNick.</p>
          </div>
        `,
      });

      console.log("Message sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
