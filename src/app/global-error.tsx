"use client";

import { ErrorPageShell, type RouteErrorProps } from "@/components/error-state";
import { ErrorRecovery } from "@/components/error-recovery";
import { fontVariables } from "./fonts";
import "./globals.css";

export default function GlobalError({ retry }: RouteErrorProps) {
  return (
    <html lang="en" className={`${fontVariables} antialiased`}>
      <body className="min-h-dvh">
        <title>Something went wrong | Pascack Course Planner</title>
        <ErrorPageShell>
          <ErrorRecovery retry={retry} />
        </ErrorPageShell>
      </body>
    </html>
  );
}
