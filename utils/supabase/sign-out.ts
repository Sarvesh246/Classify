"use client";

import { signOutFirebase } from "@/lib/firebase/auth";
import { createClient } from "@/utils/supabase/client";

/** Ends Supabase and Firebase sessions (each no-ops if not signed in). */
export async function signOutAll(): Promise<void> {
  await createClient().auth.signOut();
  await signOutFirebase();
}
