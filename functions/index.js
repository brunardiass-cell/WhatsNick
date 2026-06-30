const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function that listens for new messages in Firestore 'chats_v3/{chatId}/messages/{messageId}'
 * and triggers a push notification to the recipient using FCM.
 */
exports.sendNotificationOnMessage = functions.firestore
  .document("chats_v3/{chatId}/messages/{messageId}")
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data();
    if (!messageData) {
      console.log("No message data found");
      return null;
    }

    const { senderId, receiverId, text } = messageData;

    if (!receiverId || !senderId) {
      console.log("Missing sender or receiver ID");
      return null;
    }

    try {
      // 1. Fetch sender profile to get their display name
      const senderDoc = await admin.firestore().collection("users_v3").doc(senderId).get();
      const senderName = senderDoc.exists ? (senderDoc.data().name || "Alguém") : "Alguém";

      // 2. Fetch receiver profile to get their FCM Token
      const receiverDoc = await admin.firestore().collection("users_v3").doc(receiverId).get();
      if (!receiverDoc.exists) {
        console.log(`Receiver ${receiverId} profile not found`);
        return null;
      }

      const receiverData = receiverDoc.data();
      const fcmToken = receiverData.fcmToken;

      if (!fcmToken) {
        console.log(`Receiver ${receiverId} does not have an FCM token registered.`);
        return null;
      }

      // 3. Construct FCM Payload
      const payload = {
        notification: {
          title: senderName,
          body: text || "Enviou uma nova mensagem",
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
              sound: "default",
              badge: 1
            }
          }
        },
        token: fcmToken
      };

      // 4. Send the push notification
      const response = await admin.messaging().send(payload);
      console.log(`Notification sent successfully to ${receiverId}. Message ID: ${response}`);
      return response;

    } catch (error) {
      console.error("Error sending push notification via Cloud Function:", error);
      return null;
    }
  });
