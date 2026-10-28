"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importCatalogCsv } from "@/lib/catalog/admin";

export function CsvImport() {
  const router = useRouter();
  const [result, setResult] = useState<{ ok: boolean; text: string; errors?: string[] } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="csv">Import CSV</label>
      <p className="text-[13px] text-muted">Creates new slugs and updates existing ones. All or nothing.</p>
      <input
        id="csv"
        type="file"
        accept=".csv,text/csv"
        disabled={pending}
        className="input !h-auto max-w-sm py-1.5 text-[13px]"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          start(async () => {
            const text = await file.text();
            const r = await importCatalogCsv(text);
            if (r.ok) {
              setResult({ ok: true, text: `Imported: ${r.data?.created ?? 0} new, ${r.data?.updated ?? 0} updated.` });
              router.refresh();
            } else setResult({ ok: false, text: r.error, errors: r.errors });
            e.target.value = "";
          });
        }}
      />
      {result && (
        <div role="status" className={result.ok ? "text-sm text-green" : "text-sm text-red"}>
          {result.text}
          {result.errors && <ul className="mt-1 list-disc pl-5 text-xs">{result.errors.map((x) => <li key={x}>{x}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
