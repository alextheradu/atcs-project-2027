/** Client-side search for the add-course panel. Pure, no framework imports. */

export interface PickerCourse {
  id: string;
  slug: string;
  name: string;
  department: string;
  level: string;
  duration: "FULL" | "HALF";
  credits: number;
  gradesOffered: number[];
  interests: string[];
}

export interface PickerFilter {
  q?: string;
  department?: string;
  level?: string;
  duration?: "FULL" | "HALF";
  credits?: number;
  grade?: number;
  interest?: string;
  exclude?: Set<string>;
}

export function filterCourses<T extends PickerCourse>(courses: T[], f: PickerFilter): T[] {
  const q = f.q?.trim().toLowerCase() ?? "";
  const matches = courses.filter((c) => {
    if (f.exclude?.has(c.id) || f.exclude?.has(c.name)) return false;
    if (f.department && c.department !== f.department) return false;
    if (f.level && c.level !== f.level) return false;
    if (f.duration && c.duration !== f.duration) return false;
    if (f.credits !== undefined && c.credits !== f.credits) return false;
    if (f.grade && !c.gradesOffered.includes(f.grade)) return false;
    if (f.interest && !c.interests.includes(f.interest)) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });
  return matches.sort((a, b) => {
    if (q) {
      const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    return a.name.localeCompare(b.name);
  });
}
