import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/page";
import { ROWS } from "@/lib/board";
import { cn } from "@/lib/utils";

const surfaces = [
  ["--bg", "#161616", "page"],
  ["--fill", "#202020", "blocks, inputs"],
  ["--fill-2", "#2a2a2a", "buttons, hover"],
  ["--fill-3", "#333333", "hover on fill-2"],
  ["--fg", "#efefef", "text"],
  ["--muted", "#a3a3a3", "secondary text"],
  ["--dim", "#6e6e6e", "placeholders"],
];
const accents = [
  ["--accent", "#2f6fe4", "clickable, selected"],
  ["--green", "#33d6a6", "done, eligible"],
  ["--yellow", "#f1c40f", "warning"],
  ["--orange", "#ff8c37", "needs a review"],
  ["--red", "#ec3750", "locked, denied"],
];

function Swatch({ name, hex, use }: { name: string; hex: string; use: string }) {
  return (
    <div>
      <div className="h-12 rounded-[10px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]" style={{ background: `var(${name})` }} />
      <div className="mt-2 text-[13px] font-semibold">{name}</div>
      <div className="num text-[13px] text-muted">{hex}, {use}</div>
    </div>
  );
}

export default function Styleguide() {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-16">
      <PageHeader
        title="Styleguide"
        description="Neutral charcoal, Figtree, one blue for things you can click, and a color per subject. Space and soft fills separate things, not lines."
      />

      <div className="space-y-12">
        <Section title="Surfaces and text">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-7">
            {surfaces.map(([n, h, u]) => <Swatch key={n} name={n} hex={h} use={u} />)}
          </div>
        </Section>

        <Section title="Blue and status">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
            {accents.map(([n, h, u]) => <Swatch key={n} name={n} hex={h} use={u} />)}
          </div>
        </Section>

        <Section title="Subjects" description="Only classes use these. Each has a soft fill for the tile and a brighter ink for its label.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ROWS.map((r) => (
              <div key={r.key} className={cn("tile", `subject-${r.key}`)}>
                <span className="ink block text-[12px] font-semibold">{r.label}</span>
                Sample class
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type">
          <div className="space-y-2">
            <div className="text-[52px] font-bold leading-[1.04] tracking-[-0.035em]">Display, Figtree</div>
            <div className="text-[28px] font-bold tracking-[-0.025em]">Page title</div>
            <h2 className="eyebrow">Section title</h2>
            <p className="text-[15px]">Body text. Plan your four years and see what is missing.</p>
            <p className="text-[14px] text-muted">Secondary text for hints and captions.</p>
            <p className="num">5 cr, 92.5 of 120 credits, B+</p>
          </div>
        </Section>

        <Section title="Buttons" description="The primary button is the contd sticker: hard lip, lifts and tilts on hover, squishes on press. One per screen.">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Add a class</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Remove</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg" variant="primary">Large</Button>
          </div>
        </Section>

        <Section title="Board pieces">
          <div className="grid max-w-[640px] grid-cols-[120px_repeat(3,minmax(0,1fr))] gap-2">
            <div className="subject-science flex flex-col justify-center">
              <span className="ink text-[14px] font-bold">Science</span>
              <span className="text-[12px] text-muted">1 more</span>
            </div>
            <div className="tile subject-science">Biology<span className="ink mt-1 block text-[12px]">5 cr, Done, A</span></div>
            <div className="tile subject-science">Chemistry<span className="ink mt-1 block text-[12px]">5 cr</span><span className="mt-1 flex items-center gap-1.5 text-[12px]"><span className="size-2 rounded-full bg-yellow" />Add your grade for Biology.</span></div>
            <button type="button" className="tile-empty">+ Pick a physics class</button>
          </div>
        </Section>

        <Section title="Status" description="Always a dot and a word.">
          <div className="flex flex-wrap gap-4">
            <Badge tone="eligible">Can take</Badge>
            <Badge tone="warning">Check first</Badge>
            <Badge tone="appeal">Needs a review</Badge>
            <Badge tone="locked">Missing a prerequisite</Badge>
            <Badge tone="review">In review</Badge>
            <Badge>Draft</Badge>
          </div>
        </Section>

        <Section title="Rows" description="Rows are separated by space. A row fills softly on hover; a selected row gets a fill and a blue dot.">
          <ul className="list list-hover max-w-[640px]">
            <li className="flex items-baseline justify-between py-2.5">
              <span><span className="block text-[15px] font-medium">Honors Biology</span><span className="block text-[13px] text-muted">Honors, grades 9, 10</span></span>
              <span className="num text-muted">5 cr</span>
            </li>
            <li className="row-selected flex items-baseline justify-between py-2.5 !pl-5">
              <span><span className="block text-[15px] font-medium">Selected row</span><span className="block text-[13px] text-muted">Fill and a blue dot</span></span>
              <span className="num text-muted">2.5 cr</span>
            </li>
          </ul>
        </Section>

        <Section title="Inputs">
          <div className="flex max-w-md flex-col gap-3">
            <input className="input" placeholder="Search classes" />
            <select className="input"><option>Any subject</option></select>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" defaultChecked /> Only classes offered in 11th grade</label>
          </div>
        </Section>
      </div>
    </main>
  );
}
