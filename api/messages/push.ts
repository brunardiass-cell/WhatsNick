import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import dotenv from "dotenv";
import firebaseConfig from "../../firebase-applet-config.json";

dotenv.config();

export const runtime = "nodejs";

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : undefined;

    if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      initializeApp({
        credential: cert({
          projectId: firebaseConfig.projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        })
      });
    } else {
      initializeApp({
        projectId: firebaseConfig.projectId
      });
    }
  } catch (err) {
    console.error("Firebase Admin initialization error in messages push:", err);
  }
}

export default async function handler(req: any, res: any) {
  console.log("API Messages Push chamada");
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fromName, toUid, text } = req.body;

  if (!toUid) {
    return res.status(400).json({ error: "Missing recipient user ID (toUid)" });
  }

  try {
    const dbId = firebaseConfig.firestoreDatabaseId;
    const db = dbId ? getFirestore(dbId) : getFirestore();
    
    // Fetch recipient's document to get fcmToken
    const userDoc = await db.collection("users_v3").doc(toUid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    const lastOrigin = userData?.lastOrigin;

    if (!fcmToken) {
      console.warn(`No FCM Token found for user ${toUid}`);
      return res.json({ success: false, reason: "No FCM Token found for this user." });
    }

    // Try to get dynamic link from request context or lastOrigin or standard fallback
    const fallbackOrigin = "https://ais-pre-xbn6ncjpnjsoquekskewi6-80440826789.us-east1.run.app";
    const headerOrigin = req.headers.referer || req.headers.origin;
    let webLink = lastOrigin || fallbackOrigin;
    if (headerOrigin) {
      try {
        webLink = new URL(headerOrigin).origin;
      } catch (e) {
        // Ignore parsing error
      }
    }

    const title = fromName || "Nova mensagem";
    const body = text || "Enviou uma nova mensagem";

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        title,
        body,
        click_action: webLink,
        link: webLink,
      },
      android: {
        notification: {
          color: "#F48FB1",
          sound: "default"
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: "default"
          }
        }
      },
      webpush: {
        headers: {
          Urgency: "high"
        },
        notification: {
          title,
          body,
          icon: `${webLink}/icon.png`,
          badge: `${webLink}/icon.png`,
          requireInteraction: true,
        },
        fcmOptions: {
          link: webLink,
        }
      },
      token: fcmToken,
    };

    const response = await getMessaging().send(message);
    console.log("FCM push sent successfully for message:", response);

    return res.json({ success: true, messageId: response });
  } catch (error: any) {
    console.error("Error sending FCM notification for message:", error);
    return res.status(500).json({ error: "Failed to send push notification", details: error.message });
  }
}
