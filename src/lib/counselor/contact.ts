export const HILLS_COUNSELING = "https://hills.pascack.org/services/guidance-counseling-services";
export const VALLEY_COUNSELING = "https://valley.pascack.org/services/guidance-counseling";

export function hillsCounselorForName(name: string | null) {
  const parts = name?.trim().split(/\s+/) ?? [];
  if (/^(jr|sr|ii|iii|iv)\.?$/i.test(parts.at(-1) ?? "")) parts.pop();
  const lastName = parts.length >= 2 ? parts.at(-1) : undefined;
  // The owner confirmed the P assignment. Use the directories for other initials.
  return lastName && /^p(?:\p{L}|\.?$)/iu.test(lastName)
    ? { name: "Marin Donnelly", email: "mdonnelly@pascack.org" }
    : null;
}
