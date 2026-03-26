import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, getDocFromServer, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
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
  deleteField
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
