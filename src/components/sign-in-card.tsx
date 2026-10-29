"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/account/actions";
import { answerAge } from "@/lib/onboarding/actions";

const ERRORS: Record<string, string> = {
  domain_not_allowed: "That email domain is not allowed yet. Use your school Google account.",
  invite_required: "Sign-up is invite only right now. Ask an admin for an invite.",
  email_not_verified: "Google says that email is not verified.",
  age_required: "Tell us if you are 13 or older first.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  AccessDenied: "Sign-in was denied.",
};

export function SignInCard() {
  // Under 13 stores nothing. "13 or older" sets a short lived signed cookie, nothing else.
  const [answer, setAnswer] = useState<"over13" | "under13" | null>(null);
  const error = useSearchParams().get("error");

  return (
    <div className="w-full max-w-[320px]">
      <h2 className="text-[15px] font-medium tracking-tight">Sign in</h2>
      <p className="mt-1 text-[13px] text-muted">Use your Google account.</p>

      {answer === "under13" ? (
        <div className="mt-6" role="status">
          <p className="text-[13px] font-medium">Come back when you are 13.</p>
          <p className="mt-1 text-[13px] text-muted">This tool is for students 13 and older. We did not save anything. Ask a parent or your school if you need help with course selection.</p>
        </div>
      ) : (
        <fieldset className="mt-6">
          <legend className="text-[13px] text-muted">How old are you?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-sm" aria-pressed={answer === "over13"} onClick={() => { setAnswer("over13"); void answerAge(true); }}>13 or older</button>
            <button type="button" className="btn btn-sm" onClick={() => { setAnswer("under13"); void answerAge(false); }}>Under 13</button>
          </div>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[13px] text-red">
          {ERRORS[error] ?? "Could not sign you in."}
        </p>
      )}

      {answer !== "under13" && (
        <form action={signInWithGoogle} className="mt-4">
          <Button variant="primary" size="lg" className="w-full" type="submit" disabled={answer !== "over13"}>
            Continue with Google
          </Button>
        </form>
      )}
    </div>
  );
}
