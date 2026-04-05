"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import { createClient } from "@/utils/supabase/client";

export type CombinedAuthUser = {
  source: "supabase" | "firebase";
  email: string | null;
  displayLabel: string;
};

function labelFromSupabase(u: SupabaseUser): string {
  const meta = u.user_metadata as Record<string, string | undefined> | undefined;
  return meta?.full_name || meta?.name || u.email || "Signed in";
}

function labelFromFirebase(u: FirebaseUser): string {
  return u.displayName || u.email || "Signed in";
}

function mergeUsers(firebaseUser: FirebaseUser | null, supabaseUser: SupabaseUser | null) {
  if (supabaseUser) {
    return {
      source: "supabase" as const,
      email: supabaseUser.email ?? null,
      displayLabel: labelFromSupabase(supabaseUser),
    };
  }
  if (firebaseUser) {
    return {
      source: "firebase" as const,
      email: firebaseUser.email ?? null,
      displayLabel: labelFromFirebase(firebaseUser),
    };
  }
  return null;
}

/** Tracks Firebase + Supabase sessions; Supabase wins when both exist. */
export function useCombinedAuth(): {
  user: CombinedAuthUser | null | undefined;
  hydrated: boolean;
  /** Present when Supabase Auth has a session — required for cloud sync API routes. */
  supabaseUserId: string | null;
} {
  const [user, setUser] = useState<CombinedAuthUser | null | undefined>(undefined);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  useEffect(() => {
    let firebaseUser: FirebaseUser | null = null;
    let supabaseUser: SupabaseUser | null = null;

    const merge = () => {
      setUser(mergeUsers(firebaseUser, supabaseUser));
      setSupabaseUserId(supabaseUser?.id ?? null);
    };

    const unsubFirebase = subscribeToAuthState((u) => {
      firebaseUser = u;
      merge();
    });

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      supabaseUser = session?.user ?? null;
      merge();
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      supabaseUser = session?.user ?? null;
      merge();
    });

    return () => {
      unsubFirebase();
      subscription.unsubscribe();
    };
  }, []);

  return { user, hydrated: user !== undefined, supabaseUserId };
}
