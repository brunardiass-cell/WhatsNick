import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const runtime = "nodejs";

const app = express();
app.use(cors());
app.use(express.json());

// SOS Email Endpoint
app.post("/api/sos/email", async (req, res) => {
  console.log("🚨 SOS API: Request received");
  const { fromEmail, toEmail, senderName, location } = req.body;
  console.log(`🚨 SOS API: From: ${fromEmail}, To: ${toEmail}, Name: ${senderName}`);

  if (!fromEmail || !toEmail) {
    console.error("🚨 SOS API: Missing emails in request body");
    return res.status(400).json({ error: "Missing emails" });
  }

  try {
    console.log("🚨 SOS API: Configuring transporter...");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      requireTLS: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const locationLink = location 
      ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
      : "Localização não disponível";

    console.log("🚨 SOS API: Sending email...");
    const info = await transporter.sendMail({
      from: `"WhatsNick SOS" <${process.env.SMTP_USER}>`,
      to: toEmail,
      replyTo: fromEmail,
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

    console.log("🚨 SOS API: Email sent successfully!", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("🚨 SOS API: Error sending email:", error);
    res.status(500).json({ error: "Failed to send email", details: error instanceof Error ? error.message : String(error) });
  }
});

export default app;
