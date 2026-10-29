import type { Metadata } from "next";
import { ErrorPageShell, NotFoundState } from "@/components/error-state";

export const metadata: Metadata = {
  title: "Page not found | Pascack Course Planner",
};

export default function NotFound() {
  return (
    <ErrorPageShell>
      <NotFoundState />
    </ErrorPageShell>
  );
}
