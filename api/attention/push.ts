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
    console.error("Firebase Admin initialization error:", err);
  }
}

export default async function handler(req: any, res: any) {
  console.log("[FCM_BACKEND_DEBUG] API Attention Push handler invoked");
  
  // Log presence of crucial environment variables
  console.log("[FCM_BACKEND_DEBUG] Env Check:", {
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "Configured" : "MISSING",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? `Configured (Length: ${process.env.FIREBASE_PRIVATE_KEY.length})` : "MISSING",
    projectId: firebaseConfig.projectId
  });
  
  if (req.method !== "POST") {
    console.warn("[FCM_BACKEND_DEBUG] Rejected non-POST request:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fromName, toUid } = req.body;
  console.log(`[FCM_BACKEND_DEBUG] Request parameters - fromName: "${fromName}", toUid: "${toUid}"`);

  if (!toUid) {
    console.warn("[FCM_BACKEND_DEBUG] Missing recipient user ID (toUid)");
    return res.status(400).json({ error: "Missing recipient user ID (toUid)" });
  }

  try {
    const dbId = firebaseConfig.firestoreDatabaseId;
    console.log(`[FCM_BACKEND_DEBUG] Fetching Firestore instance. dbId: "${dbId || "default"}"`);
    const db = dbId ? getFirestore(dbId) : getFirestore();
    
    // Fetch recipient's document to get fcmToken
    console.log(`[FCM_BACKEND_DEBUG] Querying Firestore for user: "users_v3/${toUid}"`);
    const userDoc = await db.collection("users_v3").doc(toUid).get();
    
    if (!userDoc.exists) {
      console.warn(`[FCM_BACKEND_DEBUG] Firestore user document "users_v3/${toUid}" does NOT exist.`);
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    const lastOrigin = userData?.lastOrigin;

    console.log(`[FCM_BACKEND_DEBUG] User document retrieved. hasFcmToken: ${!!fcmToken}, lastOrigin: "${lastOrigin || "none"}"`);
    if (fcmToken) {
      console.log(`[FCM_BACKEND_DEBUG] FCM Token value (first 15 chars): "${fcmToken.substring(0, 15)}..." (Length: ${fcmToken.length})`);
    }

    if (!fcmToken) {
      console.warn(`[FCM_BACKEND_DEBUG] No FCM Token found for user ${toUid}`);
      return res.json({ success: false, reason: "No FCM Token found for this user in users_v3." });
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

    const title = "🔔 Chamar Atenção!";
    const body = `${fromName || "Alguém"} está chamando sua atenção no WhatsNicky!`;

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
          icon: "stock_ticker_update",
          color: "#F48FB1"
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

    console.log("[FCM_BACKEND_DEBUG] Constructing FCM message payload:", JSON.stringify(message, null, 2));
    
    console.log("[FCM_BACKEND_DEBUG] Triggering getMessaging().send(message)...");
    const response = await getMessaging().send(message);
    console.log("[FCM_BACKEND_DEBUG] FCM push sent successfully. Response messageId:", response);

    return res.json({ success: true, messageId: response });
  } catch (error: any) {
    console.error("[FCM_BACKEND_DEBUG] Error sending FCM notification:", error);
    return res.status(500).json({ 
      error: "Failed to send push notification", 
      details: error.message,
      code: error.code,
      info: error.errorInfo || null
    });
  }
}
