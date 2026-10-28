import { connection } from "next/server";
import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/guards";
import { exportCatalogCsv } from "@/lib/catalog/admin";

export async function GET() {
  await connection();
  try {
    const csv = await exportCatalogCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="catalog.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof UnauthenticatedError) return new Response("Sign in required", { status: 401 });
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
}
