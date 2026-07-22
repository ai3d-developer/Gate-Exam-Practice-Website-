import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAr-VuJ9PILcYH45V6-YZcP5T8dNAgXkD4",
  authDomain: "gate-cd3f0.firebaseapp.com",
  databaseURL: "https://gate-cd3f0-default-rtdb.firebaseio.com",
  projectId: "gate-cd3f0",
  storageBucket: "gate-cd3f0.firebasestorage.app",
  messagingSenderId: "410331262912",
  appId: "1:410331262912:web:a2e64924444c4fc9d0a225",
  measurementId: "G-K9DGENWG3J"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app, "https://gate-cd3f0-default-rtdb.firebaseio.com");

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Admin email — whoever signs in with this email gets Admin role
export const ADMIN_EMAIL = 'Gate2026@gmail.com';

// Try popup first; if blocked or fails, fall back to redirect
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (err) {
    // popup-blocked or cross-origin: fall back to redirect flow
    if (
      err.code === 'auth/popup-blocked' ||
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null; // page will redirect; result handled via getRedirectResult
    }
    throw err;
  }
}

// Called on mount to pick up redirect result after page reload
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result;
  } catch (err) {
    console.error('Redirect result error:', err);
    return null;
  }
}

export async function signInAdmin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}
