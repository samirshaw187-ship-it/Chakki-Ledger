import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Web app Firebase configuration supplied by user
export const firebaseConfig = {
  apiKey: "AIzaSyDm3PF5LLtuPtKljmpvfudec5RLTgk0A7I",
  authDomain: "chakki-ledger.firebaseapp.com",
  projectId: "chakki-ledger",
  storageBucket: "chakki-ledger.firebasestorage.app",
  messagingSenderId: "640995533932",
  appId: "1:640995533932:web:b260c1b13b015d9b1c2449",
  measurementId: "G-YYLLLKYFL0",
};

// Initialize Firebase safely without duplicate app errors
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth service instance
export const auth = getAuth(app);

// Cloud Firestore database service instance
// Configured with custom databaseId if specified in firebase-applet-config.json, else default
export const db = firebaseConfigJson?.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Analytics if supported in the browser environment
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.warn('Analytics initialization skipped:', err);
      }
    }
  }).catch(() => {});
}
