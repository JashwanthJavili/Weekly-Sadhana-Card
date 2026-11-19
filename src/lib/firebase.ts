import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Firebase web config is public by design (it identifies the project, it does
// not grant access). Access is controlled by firestore.rules (+ App Check).
const firebaseConfig = {
  apiKey: "AIzaSyAe_NJdoWSZif12THNc1TyJX5np7yTDsmE",
  authDomain: "sadhanatracker-92f04.firebaseapp.com",
  databaseURL: "https://sadhanatracker-92f04-default-rtdb.firebaseio.com",
  projectId: "sadhanatracker-92f04",
  storageBucket: "sadhanatracker-92f04.firebasestorage.app",
  messagingSenderId: "896915994564",
  appId: "1:896915994564:web:812e1d6bbc1bece4675691",
  measurementId: "G-HZQTTH8G4S",
};

/**
 * Abuse protection: when a reCAPTCHA Enterprise site key is configured (build-time env
 * NEXT_PUBLIC_RECAPTCHA_SITE_KEY), every Firestore/Auth request carries an App Check token,
 * so the backend can reject traffic that doesn't come from this website.
 */
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

export function getFirebase() {
  if (typeof window === "undefined") throw new Error("Firebase is only used in the browser.");
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);

    if (RECAPTCHA_SITE_KEY) {
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        // Prints a debug token in the console; register it in Firebase Console → App Check.
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }

    try {
      // Offline cache: cards open instantly and edits survive a flaky connection.
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      db = getFirestore(app);
    }
    auth = getAuth(app);
    void import("firebase/analytics")
      .then(async ({ getAnalytics, isSupported }) => {
        if (await isSupported()) getAnalytics(app!);
      })
      .catch(() => undefined);
  }
  return { app: app!, db: db!, auth: auth! };
}

/** Friendly text for Firebase Auth errors. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return "This sign-in method is not switched on yet (Firebase Console → Authentication → Sign-in method).";
    case "auth/unauthorized-domain":
      return "This website isn't allowed to use Google sign-in yet (Firebase Console → Authentication → Settings → Authorized domains).";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Please allow pop-ups and try again.";
    case "auth/network-request-failed":
      return "No internet connection. Please check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
