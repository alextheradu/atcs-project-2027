import { db } from "@/lib/db";
import { GUIDANCE_KEY, parseGuidance } from "./index";

/** The saved guidance, or the Program of Studies defaults. */
export async function loadGuidance() {
  const row = await db.appSetting.findUnique({ where: { key: GUIDANCE_KEY } });
  return parseGuidance(row?.value);
}
