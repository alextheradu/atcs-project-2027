"use client";

export function PrintButton() {
  return <button type="button" className="rounded border border-black bg-white px-3 py-1.5 text-sm text-black hover:bg-neutral-100" onClick={() => window.print()}>Print or save as PDF</button>;
}
