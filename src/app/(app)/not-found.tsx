import { NotFoundState } from "@/components/error-state";

export default function WorkspaceNotFound() {
  return (
    <div className="flex min-h-[55dvh] items-center py-8">
      <NotFoundState />
    </div>
  );
}
