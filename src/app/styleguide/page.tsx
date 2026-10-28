import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StarBorder } from "@/components/ui/star-border";

const surfaces = [
  ["--bg", "#0a0a0a"],
  ["--bg-raised", "#141414"],
  ["--bg-elevated", "#1c1c1c"],
  ["--line", "#2b2b2b"],
  ["--line-strong", "#3d3d3d"],
  ["--fg", "#ededed"],
  ["--muted", "#a1a1a1"],
];
const accents = [
  ["--accent", "#338eda"],
  ["--green", "#33d6a6"],
  ["--yellow", "#f1c40f"],
  ["--orange", "#ff8c37"],
  ["--red", "#ec3750"],
];

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="card p-3">
      <div className="h-10 rounded-md border border-line" style={{ background: `var(${name})` }} />
      <div className="mt-2 font-mono text-xs">{name}</div>
      <div className="font-mono text-xs text-muted">{hex}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function Styleguide() {
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Styleguide</h1>
      <p className="mt-2 max-w-xl text-muted">
        Neutral black and charcoal surfaces. Blue appears only on interactive elements.
      </p>

      <Section title="Surfaces">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {surfaces.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}
        </div>
      </Section>

      <Section title="Accent and status">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {accents.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}
        </div>
      </Section>

      <Section title="Type">
        <div className="card space-y-2 p-6">
          <div className="text-2xl font-semibold tracking-tight">Geist Sans heading</div>
          <p>Body text at 14px. Plan your four years, track credits, and see what is missing.</p>
          <p className="text-muted">Muted secondary text for hints and captions.</p>
          <p className="font-mono text-sm">MATH-201 &nbsp; 5.0 credits &nbsp; B+ &nbsp; 2027-02-09</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">Large</Button>
          <StarBorder>
            <Button variant="primary">Submit appeal</Button>
          </StarBorder>
        </div>
      </Section>

      <Section title="Status badges">
        <div className="flex flex-wrap gap-2">
          <Badge tone="eligible">Eligible</Badge>
          <Badge tone="warning">Eligible with warning</Badge>
          <Badge tone="appeal">Needs appeal</Badge>
          <Badge tone="locked">Locked</Badge>
          <Badge tone="review">Appeal in review</Badge>
          <Badge tone="eligible">Appeal approved</Badge>
          <Badge tone="locked">Appeal denied</Badge>
        </div>
      </Section>

      <Section title="Cards and inputs">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <div className="font-medium">Honors Biology</div>
            <div className="mt-1 font-mono text-xs text-muted">5.0 credits · Grade 9</div>
          </div>
          <div className="card card-selected p-4">
            <div className="font-medium">Selected card</div>
            <div className="mt-1 font-mono text-xs text-muted">Neutral fill, 2px accent bar</div>
          </div>
          <div className="card space-y-3 p-4">
            <input className="input" placeholder="Search courses" />
            <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
              <div className="h-full w-2/3 bg-accent" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Sign-in texture">
        <div className="card p-8">
          <div className="auth-texture mx-auto max-w-sm rounded-xl border border-line p-6">
            <input className="input auth-texture" placeholder="Checkerboard input" />
            <Button className="auth-texture mt-4 w-full">Continue with Google</Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
