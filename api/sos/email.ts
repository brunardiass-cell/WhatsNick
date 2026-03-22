import nodemailer from "nodemailer";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("API SOS chamada (Vercel)");
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
      from: `"WhatsNicky SOS" <${process.env.SMTP_USER || fromEmail}>`,
      to: toEmail,
      replyTo: fromEmail,
      subject: `🚨 ALERTA SOS: ${senderName} precisa de ajuda!`,
      text: `${senderName} (${fromEmail}) acionou um alerta SOS no WhatsNicky! \n\nLocalização: ${locationLink}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid red; border-radius: 10px;">
          <h1 style="color: red;">🚨 ALERTA SOS</h1>
          <p><strong>${senderName}</strong> (${fromEmail}) acionou um alerta SOS no WhatsNicky!</p>
          <p><strong>Localização:</strong> <a href="${locationLink}">${locationLink}</a></p>
          <hr />
          <p style="font-size: 12px; color: #666;">Este é um alerta automático de segurança do WhatsNicky.</p>
        </div>
      `,
    });

    console.log("SOS Email sent successfully to:", toEmail, "Message ID:", info.messageId);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
}
