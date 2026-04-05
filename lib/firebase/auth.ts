import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase/client";

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  return getAuth(app);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle(): Promise<
  { ok: true; user: User } | { ok: false; error: string }
> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      ok: false,
      error: "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables to .env.local.",
    };
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { ok: true, user: result.user };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    const message = e instanceof Error ? e.message : "Sign-in failed.";

    if (code === "auth/popup-closed-by-user") {
      return { ok: false, error: "Sign-in was cancelled." };
    }
    if (code === "auth/popup-blocked") {
      return {
        ok: false,
        error: "Pop-up was blocked. Allow pop-ups for this site and try again.",
      };
    }
    if (code === "auth/unauthorized-domain") {
      return {
        ok: false,
        error:
          "This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.",
      };
    }

    return { ok: false, error: message };
  }
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
