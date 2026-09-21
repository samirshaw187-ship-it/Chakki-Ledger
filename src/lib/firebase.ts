/**
 * Chakki Ledger - Firebase SDK Client Configuration
 * Single Source of Truth for Firebase App, Auth, and Firestore
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Project configuration provided by Firebase setup
export const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey || 'AIzaSyA1QVaZ93nwd2rAeqymw4BtjV2FyubGThY',
  authDomain: firebaseAppletConfig.authDomain || 'chakki-bussiness.firebaseapp.com',
  projectId: firebaseAppletConfig.projectId || 'chakki-bussiness',
  storageBucket: firebaseAppletConfig.storageBucket || 'chakki-bussiness.firebasestorage.app',
  messagingSenderId: firebaseAppletConfig.messagingSenderId || '645041401245',
  appId: firebaseAppletConfig.appId || '1:645041401245:web:8b4474de8ce97707d51374',
};

// Initialize Firebase once
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export Firebase Auth instance
export const auth = getAuth(firebaseApp);

// Export Firestore instance
// Use named database if specified, or default instance
export const db = firebaseAppletConfig.firestoreDatabaseId && firebaseAppletConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(firebaseApp, firebaseAppletConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);
