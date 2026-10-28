"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/account/actions";

const ERRORS: Record<string, string> = {
  domain_not_allowed: "That email domain is not allowed yet. Use your school Google account.",
  invite_required: "Sign-up is invite only right now. Ask an admin for an invite.",
  email_not_verified: "Google says that email is not verified.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  AccessDenied: "Sign-in was denied.",
};

export function SignInCard() {
  // Stub age gate. Phase 5 replaces this with the real gate that stores nothing for under 13.
  const [thirteen, setThirteen] = useState(false);
  const error = useSearchParams().get("error");

  return (
    <div className="auth-texture w-full max-w-sm rounded-xl border border-line p-6">
      <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
      <p className="mt-1 text-sm text-muted">Use your Google account. You must be 13 or older.</p>

      <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={thirteen}
          onChange={(e) => setThirteen(e.target.checked)}
          className="size-4 accent-[var(--accent)]"
        />
        I am 13 or older
      </label>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red">
          {ERRORS[error] ?? "Could not sign you in."}
        </p>
      )}

      <form action={signInWithGoogle} className="mt-5">
        <Button variant="primary" className="w-full" type="submit" disabled={!thirteen}>
          Continue with Google
        </Button>
      </form>
    </div>
  );
}
