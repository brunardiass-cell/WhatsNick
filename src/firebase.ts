import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, getDocFromServer, deleteDoc, updateDoc, deleteField, enableNetwork, disableNetwork } from 'firebase/firestore';
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

  // If dbId is missing, empty, or "(default)", use the default database
  if (!dbId || dbId === "(default)") {
    console.log("Initializing Firestore with DEFAULT database and long polling enabled.");
    dbInstance = initializeFirestore(app, firestoreSettings);
  } else {
    console.log("Initializing Firestore with NAMED database:", dbId, "and long polling enabled.");
    try {
      dbInstance = initializeFirestore(app, firestoreSettings, dbId);
    } catch (innerError) {
      console.error("Failed to initialize named database, falling back to default:", innerError);
      dbInstance = initializeFirestore(app, firestoreSettings);
    }
  }
  console.log("Firestore instance created successfully.");
} catch (e) {
  console.error("Failed to initialize Firestore with settings, falling back to basic getFirestore:", e);
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
