export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-elevated" />
      <div className="h-24 w-full animate-pulse rounded-[var(--radius-card)] bg-raised" />
    </div>
  );
}
