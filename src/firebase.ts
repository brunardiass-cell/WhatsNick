import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, getDocFromServer, deleteDoc, updateDoc, deleteField, enableNetwork, disableNetwork } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// Improved Firestore initialization with fallback and long polling
let dbInstance;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  const firestoreSettings = {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  };

  if (dbId && dbId !== "(default)") {
    console.log("Initializing Firestore with named database:", dbId, "and long polling enabled.");
    dbInstance = initializeFirestore(app, firestoreSettings, dbId);
  } else {
    console.log("Initializing Firestore with default database and long polling enabled.");
    dbInstance = initializeFirestore(app, firestoreSettings);
  }
} catch (e) {
  console.error("Failed to initialize Firestore with settings, falling back to basic getFirestore:", e);
  // Fallback to basic initialization if initializeFirestore fails
  const { getFirestore } = require('firebase/firestore');
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  serverTimestamp,
  getDocFromServer,
  deleteDoc,
  updateDoc,
  deleteField,
  enableNetwork,
  disableNetwork
};

// Test connection
async function testConnection() {
  try {
    console.log("Testing Firestore connection to database:", (firebaseConfig as any).firestoreDatabaseId || "(default)");
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("Firestore connection successful.");
  } catch (error) {
    console.error("Firestore connection test failed:", error);
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("CRITICAL: The Firestore client is offline. This usually means the configuration (Project ID, API Key, or Database ID) is incorrect or the network is blocked.");
    }
  }
}
testConnection();
