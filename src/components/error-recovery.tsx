"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Recovery must reload the document if the client router fails. */
import { useTransition } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

export function ErrorRecovery({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <ErrorState
      code="500"
      label="Something went wrong"
      title="We couldn’t load this page."
      description="Try again in a moment. If you were saving changes, check that they saved before submitting again."
    >
      <Button variant="primary" onClick={() => startTransition(retry)} disabled={pending} aria-busy={pending}>
        {pending ? "Trying again…" : "Try again"}
      </Button>
      <a href="/" className="btn">Go home</a>
    </ErrorState>
  );
}
