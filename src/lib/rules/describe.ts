/** A rule tree in plain words, for the editor's "reads as" preview and the audit trail. Pure. */
import { gradeText, type Rule } from "@/lib/eligibility";

const name = (names: Record<string, string>, slug: string) => names[slug] ?? slug;
const list = (names: Record<string, string>, slugs: string[]) => slugs.map((s) => name(names, s)).join(" or ");

export function describeRule(rule: Rule, names: Record<string, string> = {}): string {
  switch (rule.type) {
    case "all":
      return rule.rules.map((r) => describeRule(r, names)).join("; and ");
    case "any":
      return `one of: ${rule.rules.map((r) => `(${describeRule(r, names)})`).join(" or ")}`;
    case "completed":
      return `completed ${list(names, rule.courses)}`;
    case "minGrade":
      return `${gradeText(rule.grade)} or higher in ${list(names, rule.courses)}`;
    case "gradeLevel":
      return `grade ${rule.in.join(", ")}`;
    case "coreq":
      return `${list(names, rule.courses)} ${rule.timing === "sameYear" ? "in the same school year" : "in the same year or earlier"}`;
    case "priorCoursework":
      return `8th grade ${rule.value === "ALGEBRA_I" ? "Algebra I" : rule.value === "PRE_ALGEBRA" ? "Pre-Algebra" : "math"}${rule.minGrade ? ` with ${gradeText(rule.minGrade)} or higher` : ""}`;
    case "manual":
      return `${rule.label || "(no label)"} (checked by a person)`;
  }
}
