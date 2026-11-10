import Link from "next/link";
import { PathMap } from "@/components/pathways/path-map";
import { COMPACT, layoutMap } from "@/lib/pathways/layout";
import { loadMapClasses, loadPathwayStudent, type MapStatus } from "@/lib/pathways/load";
import {
  LANGUAGES, LANGUAGE_LABEL, MATH_STARTS, START_LABEL, SUBJECTS, SUBJECT_LABEL,
  mapSlugs, pathMap, pathwayQuerySchema, pruneMap, type Language, type MathStart, type MoveKind, type Subject,
} from "@/lib/pathways/maps";
import { cn } from "@/lib/utils";

type Picked = { subject: Subject; start: MathStart; lang: Language };

function href(p: Picked): string {
  const q = new URLSearchParams({ view: "pathways", subject: p.subject });
  if (p.subject === "math") q.set("start", p.start);
  if (p.subject === "language") q.set("lang", p.lang);
  return `/courses?${q}`;
}

function Pill({ to, on, children, size = "md" }: { to: string; on: boolean; children: React.ReactNode; size?: "md" | "sm" }) {
  return (
    <Link
      href={to}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex items-center rounded-full transition-colors",
        size === "md" ? "h-9 px-3.5 text-[14px]" : "h-8 px-3 text-[13px]",
        on ? "bg-fill-2 font-semibold text-fg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}

/** A small drawing of each kind of arrow, the same strokes the map uses. */
function Sample({ kind }: { kind: MoveKind }) {
  const d = kind === "next" ? "M2 14H30" : kind === "up" ? "M2 22C16 22 16 6 30 6" : "M2 6C16 6 16 22 30 22";
  const tipY = kind === "next" ? 14 : kind === "up" ? 6 : 22;
  return (
    <svg aria-hidden width="40" height="28" viewBox="0 0 40 28" className="mt-0.5 shrink-0">
      <path d={d} fill="none" strokeWidth="1.5" strokeDasharray={kind === "next" ? undefined : "5 4"} className="stroke-muted" />
      <path d={`M30 ${tipY - 4}L38 ${tipY}L30 ${tipY + 4}z`} className="fill-muted" />
    </svg>
  );
}

const KEY: { kind: MoveKind; title: string; text: string }[] = [
  { kind: "next", title: "Same level, next year", text: "The usual step." },
  { kind: "up", title: "Move up a level", text: "Needs strong grades, usually an A, and a teacher recommendation. If you fall short, you can ask for a placement review on the class page." },
  { kind: "down", title: "Move down a level", text: "Your teacher can recommend it. Honors usually needs a B average to stay." },
];

/**
 * The Pathways view inside Classes: how one subject's classes follow one another and how moving between
 * levels works, drawn from the Program of Studies. Students also see which classes are on their Board.
 */
export async function PathwaysView({ userId, student, query }: { userId: string; student: boolean; query: Record<string, string | undefined> }) {
  const q = pathwayQuerySchema.parse(query);
  const me = student ? await loadPathwayStudent(userId) : null;
  const picked: Picked = { subject: q.subject ?? "math", start: q.start ?? me?.start ?? "algebra", lang: q.lang ?? me?.lang ?? "spanish" };

  const full = pathMap(picked.subject, picked);
  const classes = await loadMapClasses(mapSlugs(full));
  const map = pruneMap(full, new Set(Object.keys(classes)));
  const status: Record<string, MapStatus> = me?.status ?? {};

  return (
    <div className="space-y-8">
      <section aria-labelledby="key-title" className="max-w-[1040px]">
        <h2 id="key-title" className="eyebrow">How levels work</h2>
        <p className="mt-1 max-w-[65ch] text-[15px] text-muted">
          Each subject comes in levels. Higher rows on the map are harder levels. Each year you take the next class, and you can change level between years.
        </p>
        <ul className="mt-4 grid gap-5 sm:grid-cols-3">
          {KEY.map((k) => (
            <li key={k.kind} className="flex gap-3">
              <Sample kind={k.kind} />
              <div>
                <p className="text-[15px] font-semibold">{k.title}</p>
                <p className="mt-0.5 text-[14px] text-muted">{k.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={`${SUBJECT_LABEL[picked.subject]} pathway`} className="space-y-4">
        <nav aria-label="Subject" className="flex flex-wrap gap-1">
          {SUBJECTS.map((s) => (
            <Pill key={s} to={href({ ...picked, subject: s })} on={s === picked.subject}>{SUBJECT_LABEL[s]}</Pill>
          ))}
        </nav>

        {picked.subject === "math" && (
          <nav aria-label="8th grade math" className="flex flex-wrap items-center gap-1">
            <span className="mr-2 text-[13px] text-muted">In 8th grade</span>
            {MATH_STARTS.map((s) => (
              <Pill key={s} size="sm" to={href({ ...picked, start: s })} on={s === picked.start}>{START_LABEL[s]}</Pill>
            ))}
          </nav>
        )}
        {picked.subject === "language" && (
          <nav aria-label="Language" className="flex flex-wrap items-center gap-1">
            {LANGUAGES.map((l) => (
              <Pill key={l} size="sm" to={href({ ...picked, lang: l })} on={l === picked.lang}>{LANGUAGE_LABEL[l]}</Pill>
            ))}
          </nav>
        )}

        <div className="pt-2">
          <PathMap wide={layoutMap(map)} compact={layoutMap(map, COMPACT)} title={map.title} classes={classes} status={status} />
        </div>
      </section>

      <section aria-labelledby="rules-title" className="max-w-[72ch]">
        <h2 id="rules-title" className="eyebrow">Moving levels in {SUBJECT_LABEL[picked.subject].toLowerCase()}</h2>
        <ul className="mt-3 space-y-2.5">
          {map.rules.map((r) => (
            <li key={r.text} className="text-[15px] leading-relaxed">
              {r.text} <span className="num whitespace-nowrap text-[13px] text-muted">p. {r.page}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[13px] text-muted">From the {map.source}. Click a class for its exact prerequisites. The school decides placement.</p>
      </section>
    </div>
  );
}
