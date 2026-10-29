/**
 * Browser glue for pdfjs. The PDF is read in memory and never uploaded. Client only.
 */
import type { TextItem } from "./parse";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 4;

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
}

/** Turns pdfjs text content into positioned items. Shared by the browser and the tests. */
export function toItems(content: { items: unknown[] }): TextItem[] {
  return (content.items as PdfTextItem[])
    .filter((i) => typeof i.str === "string" && Array.isArray(i.transform))
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width }));
}

export async function readTranscriptPdf(file: File): Promise<{ items: TextItem[]; width: number }> {
  if (file.size > MAX_PDF_BYTES) throw new Error("That file is too large. Transcripts are usually under 1 MB.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (doc.numPages > MAX_PDF_PAGES) throw new Error("That PDF has too many pages to be a transcript.");
  const items: TextItem[] = [];
  let width = 612;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    width = page.getViewport({ scale: 1 }).width;
    // Pages after the first are shifted down so they cannot be mistaken for the same grid.
    items.push(...toItems(await page.getTextContent()).map((i) => ({ ...i, y: i.y - (p - 1) * 10000 })));
  }
  return { items, width };
}
