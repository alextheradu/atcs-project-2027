export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-8">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-elevated" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-raised" />
      </div>
      <div className="border-t border-line">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between border-b border-line py-4">
            <div className="h-4 w-56 animate-pulse rounded bg-raised" />
            <div className="h-4 w-16 animate-pulse rounded bg-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
