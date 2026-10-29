"use client";

import type { RouteErrorProps } from "@/components/error-state";
import { ErrorRecovery } from "@/components/error-recovery";

export default function WorkspaceError({ retry }: RouteErrorProps) {
  return (
    <div className="flex min-h-[55dvh] items-center py-8">
      <title>Something went wrong | Pascack Course Planner</title>
      <ErrorRecovery retry={retry} />
    </div>
  );
}
