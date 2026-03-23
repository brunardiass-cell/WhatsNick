import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  console.log("API Attention chamada");
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fromName, toEmail, toName } = req.body;

  if (!toEmail) {
    return res.status(400).json({ error: "Missing recipient email" });
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

    const info = await transporter.sendMail({
      from: `"WhatsNicky Attention" <${process.env.SMTP_USER || "noreply@whatsnicky.com"}>`,
      to: toEmail,
      subject: `🔔 Atenção! ${fromName} está chamando você no WhatsNicky`,
      text: `Olá ${toName || ""}, \n\nVocê recebeu uma mensagem no WhatsNicky de ${fromName}. \n\nEntre no app para conferir!`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #F48FB1; border-radius: 10px;">
          <h1 style="color: #F48FB1;">🔔 Chamar Atenção</h1>
          <p>Olá <strong>${toName || "usuário"}</strong>,</p>
          <p>Você recebeu uma mensagem no WhatsNicky de <strong>${fromName}</strong>.</p>
          <p>Entre no aplicativo agora para responder!</p>
          <hr />
          <p style="font-size: 12px; color: #666;">Este é um aviso automático do WhatsNicky.</p>
        </div>
      `,
    });

    console.log("Attention Email sent successfully to:", toEmail, "Message ID:", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error sending attention email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
}
