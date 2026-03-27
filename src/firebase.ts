import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, getDocFromServer, deleteDoc, updateDoc, deleteField, enableNetwork, disableNetwork } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = (dbId && dbId !== "(default)") 
  ? getFirestore(app, dbId) 
  : getFirestore(app);

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

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
