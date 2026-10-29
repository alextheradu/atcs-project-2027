"use client";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ErrorPageShell, type RouteErrorProps } from "@/components/error-state";
import { ErrorRecovery } from "@/components/error-recovery";
import "./globals.css";

export default function GlobalError({ retry }: RouteErrorProps) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
      <body className="min-h-dvh">
        <title>Something went wrong | Pascack Course Planner</title>
        <ErrorPageShell>
          <ErrorRecovery retry={retry} />
        </ErrorPageShell>
      </body>
    </html>
  );
}
