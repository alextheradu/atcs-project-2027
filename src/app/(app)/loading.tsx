export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-[10px] bg-fill-2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-[8px] bg-fill" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-[12px] bg-fill" />
        ))}
      </div>
    </div>
  );
}
