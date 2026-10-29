import { describe, expect, it } from "vitest";
import { courseToRow, parseCsv, rowToCourseInput, serializeCsv, CSV_COLUMNS, type CourseRecord } from "./csv";
import { courseInputSchema } from "./schemas";

const sample: CourseRecord = {
  slug: "ap-calculus-bc",
  name: 'AP Calculus "BC"',
  department: "MATH",
  level: "AP",
  duration: "FULL",
  credits: 5,
  gradesOffered: [11, 12],
  description: "Line one,\nline two, with a comma.",
  prereqText: "Prerequisite: B+ in AP Pre-Calculus",
  dualEnrollment: false,
  dualEnrollmentNote: null,
  hasApExam: true,
  plannable: true,
  archived: false,
  sourcePage: 32,
  requirements: [{ kind: "MATH", credits: 5, provisional: false }],
  interests: ["engineering-building"],
};

describe("csv primitives", () => {
  it("round trips quotes, commas and newlines", () => {
    const rows = [["a", 'he said "hi"', "x,y", "line1\nline2", ""]];
    expect(parseCsv(serializeCsv(["h1", "h2", "h3", "h4", "h5"], rows)).slice(1)).toEqual(rows);
  });
  it("handles CRLF", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("neutralizes spreadsheet formulas on export and restores them on import", () => {
    const csv = serializeCsv(["x"], [["=SUM(A1)"], ["+1"], ["-2"], ["@cmd"]]);
    expect(csv).not.toMatch(/^=|\n=|\n\+|\n@/);
    expect(parseCsv(csv).slice(1)).toEqual([["=SUM(A1)"], ["+1"], ["-2"], ["@cmd"]]);
  });
});

describe("course rows", () => {
  it.each(["HONORS", "AP"] as const)("round trips dual enrollment alongside %s without a note", (level) => {
    const course = { ...sample, level, dualEnrollment: true };
    const result = rowToCourseInput([...CSV_COLUMNS], courseToRow(course));
    expect(result).toEqual({ ok: true, value: course });
    if (result.ok) expect(courseInputSchema.parse(result.value)).toMatchObject({ level, dualEnrollment: true });
  });
  it("reads older CSV files using their dual enrollment note", () => {
    const course = { ...sample, dualEnrollment: true, dualEnrollmentNote: "Partner college" };
    const header = CSV_COLUMNS.filter((column) => column !== "dualEnrollment");
    const row = courseToRow(course).filter((_, index) => CSV_COLUMNS[index] !== "dualEnrollment");
    expect(rowToCourseInput(header, row)).toEqual({ ok: true, value: course });
  });
  it("preserves an unchecked setting even when a partner note exists", () => {
    const course = { ...sample, dualEnrollment: false, dualEnrollmentNote: "Partner college" };
    expect(rowToCourseInput([...CSV_COLUMNS], courseToRow(course))).toEqual({ ok: true, value: course });
  });
  it("rejects dual enrollment as a course level", () => {
    expect(courseInputSchema.safeParse({ ...sample, level: "DUAL_ENROLLMENT" }).success).toBe(false);
  });
  it("round trips a course through a CSV row", () => {
    const row = courseToRow(sample);
    expect(row).toHaveLength(CSV_COLUMNS.length);
    const parsed = parseCsv(serializeCsv([...CSV_COLUMNS], [row]));
    const res = rowToCourseInput([...CSV_COLUMNS], parsed[1]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toMatchObject({ ...sample });
      expect(courseInputSchema.safeParse({ ...res.value, archived: undefined }).success).toBe(true);
    }
  });
  it("reports bad numbers and enums with a message", () => {
    const row = courseToRow(sample);
    row[CSV_COLUMNS.indexOf("credits")] = "lots";
    const res = rowToCourseInput([...CSV_COLUMNS], row);
    expect(res.ok).toBe(false);
  });
  it("parses requirement tags and rejects malformed ones", () => {
    const row = courseToRow({ ...sample, requirements: [{ kind: "ENGLISH", credits: 5, provisional: true }] });
    expect(row[CSV_COLUMNS.indexOf("requirements")]).toBe("ENGLISH:5:true");
    const bad = [...row];
    bad[CSV_COLUMNS.indexOf("requirements")] = "ENGLISH:five";
    expect(rowToCourseInput([...CSV_COLUMNS], bad).ok).toBe(false);
  });
  it("rejects a header with missing columns", () => {
    const res = rowToCourseInput(["slug", "name"], ["a", "b"]);
    expect(res.ok).toBe(false);
  });
});
