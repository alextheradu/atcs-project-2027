"use client";

import { ErrorPageShell, type RouteErrorProps } from "@/components/error-state";
import { ErrorRecovery } from "@/components/error-recovery";

export default function ErrorPage({ retry }: RouteErrorProps) {
  return (
    <ErrorPageShell>
      <title>Something went wrong | Pascack Course Planner</title>
      <ErrorRecovery retry={retry} />
    </ErrorPageShell>
  );
}
