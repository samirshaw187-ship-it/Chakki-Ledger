import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Web app Firebase configuration
// Supports Vercel deployment via VITE_FIREBASE_* environment variables,
// with automatic fallback to firebase-applet-config.json
export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    firebaseConfigJson?.apiKey ||
    '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    firebaseConfigJson?.authDomain ||
    '',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseConfigJson?.projectId ||
    '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    firebaseConfigJson?.storageBucket ||
    '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseConfigJson?.messagingSenderId ||
    '',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    firebaseConfigJson?.appId ||
    '',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
    firebaseConfigJson?.measurementId ||
    '',
};

// Initialize Firebase safely without duplicate app errors
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth service instance
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Cloud Firestore database service instance
// Configured with custom databaseId if specified, else default
const firestoreDbId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  firebaseConfigJson?.firestoreDatabaseId;

export const db =
  firestoreDbId && firestoreDbId !== '(default)'
    ? getFirestore(app, firestoreDbId)
    : getFirestore(app);

// Initialize Firebase Analytics if supported in the browser environment
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (err) {
          console.warn('Analytics initialization skipped:', err);
        }
      }
    })
    .catch(() => {});
}
