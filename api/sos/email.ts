import nodemailer from "nodemailer";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  console.log("🚨 API SOS chamada: Request received");

  if (req.method !== "POST") {
    console.warn("🚨 API SOS: Method not allowed", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fromEmail, toEmail, senderName, location } = req.body;
  console.log(`🚨 API SOS: From: ${fromEmail}, To: ${toEmail}, Name: ${senderName}`);

  if (!fromEmail || !toEmail) {
    console.error("🚨 API SOS: Missing emails in request body");
    return res.status(400).json({ error: "Missing emails" });
  }

  try {
    console.log("🚨 API SOS: Configuring transporter (Port 465)...");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const locationLink = location 
      ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
      : "Localização não disponível";

    console.log("🚨 API SOS: Sending email...");
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

    console.log("🚨 API SOS: Email sent successfully!", info.messageId);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("🚨 API SOS: Error sending email:", error);
    return res.status(500).json({ 
      error: "Failed to send email", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}
