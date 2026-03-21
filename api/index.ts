import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// SOS Email Endpoint
app.post("/api/sos/email", async (req, res) => {
  const { fromEmail, toEmail, senderName, location } = req.body;

  if (!fromEmail || !toEmail) {
    return res.status(400).json({ error: "Missing emails" });
  }

  try {
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

    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default app;
