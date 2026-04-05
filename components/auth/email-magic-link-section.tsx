"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function EmailMagicLinkSection() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-teal/25 bg-teal/[0.06] px-4 py-5 sm:px-5">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal">
            <Mail className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="font-medium text-ink">Check your inbox</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              We sent a sign-in link to <span className="font-medium text-ink">{email.trim()}</span>.
              It can take a minute. You can close this page—open the link from your phone or computer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu"
          className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-teal/50 focus:ring-2 focus:ring-teal/20"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="flex h-12 w-full items-center justify-center rounded-full bg-deep-ink text-sm font-semibold !text-ivory transition hover:opacity-95 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
      {error ? (
        <p className="text-sm font-medium text-copper" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
