import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";

function shouldEnableAnalytics() {
  if (typeof window === "undefined") {
    return false;
  }

  const { hostname, protocol } = window.location;
  if (protocol === "file:") {
    return false;
  }

  return !(
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  );
}

function readFirebaseConfig(): FirebaseOptions | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket || undefined,
    messagingSenderId,
    appId,
    measurementId: measurementId || undefined,
  };
}

/** Browser-only. Returns null if env is incomplete (dev / misconfiguration). */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") {
    return null;
  }

  const config = readFirebaseConfig();
  if (!config) {
    return null;
  }

  if (!getApps().length) {
    return initializeApp(config);
  }
  return getApp();
}

/** Call from the client after mount. No-ops when Analytics is not supported or env is missing. */
export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (!shouldEnableAnalytics()) {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (!(await isSupported())) {
    return null;
  }

  return getAnalytics(app);
}

export async function logAnalyticsEvent(
  name: string,
  params?: Record<string, string | number>,
): Promise<void> {
  const analytics = await initFirebaseAnalytics();
  if (!analytics) {
    return;
  }

  logEvent(analytics, name, params);
}
