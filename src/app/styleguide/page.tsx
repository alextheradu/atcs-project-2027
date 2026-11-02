import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/page";
import { StarBorder } from "@/components/ui/star-border";

const surfaces = [
  ["--bg", "#12110f"],
  ["--bg-raised", "#1b1a17"],
  ["--bg-elevated", "#24221e"],
  ["--line", "#2e2b27"],
  ["--line-strong", "#423e38"],
  ["--fg", "#ece8e1"],
  ["--muted", "#a39d93"],
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
    <div>
      <div className="h-12 rounded-md border border-line" style={{ background: `var(${name})` }} />
      <div className="num mt-2 text-fg">{name}</div>
      <div className="num text-muted">{hex}</div>
    </div>
  );
}

export default function Styleguide() {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-16">
      <PageHeader
        title="Styleguide"
        description="Neutral black and charcoal surfaces. Blue appears only on interactive elements. Rules and rows instead of boxes."
      />

      <div className="space-y-12">
        <Section title="Surfaces">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-7">
            {surfaces.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}
          </div>
        </Section>

        <Section title="Accent and status">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
            {accents.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}
          </div>
        </Section>

        <Section title="Type">
          <div className="space-y-2">
            <div className="text-[48px] font-semibold leading-[1.08] tracking-[-0.02em]">Display, IBM Plex Sans</div>
            <div className="text-[32px] font-semibold tracking-[-0.02em]">Page title</div>
            <h2 className="eyebrow">Section title, ledger header</h2>
            <p className="text-sm">Body text at 14px. Plan your four years, track credits, and see what is missing.</p>
            <p className="text-[13px] text-muted">Secondary text for hints and captions.</p>
            <p className="num">MATH-201 &nbsp; 5.0 cr &nbsp; B+ &nbsp; 2027-02-09</p>
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

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            <Badge tone="eligible">Eligible</Badge>
            <Badge tone="warning">Eligible with warning</Badge>
            <Badge tone="appeal">Needs appeal</Badge>
            <Badge tone="locked">Locked</Badge>
            <Badge tone="review">Appeal in review</Badge>
            <Badge tone="eligible">Appeal approved</Badge>
            <Badge tone="locked">Appeal denied</Badge>
            <Badge>Draft</Badge>
          </div>
        </Section>

        <Section title="Rows" description="Lists use hairline rules. A selected row gets a neutral fill and a small accent dot. No side stripes.">
          <ul className="list list-hover">
            <li className="flex items-baseline justify-between py-3">
              <span><span className="block text-sm font-medium">Honors Biology</span><span className="block text-[13px] text-muted">Science · Honors</span></span>
              <span className="num text-right text-muted"><span className="block text-fg">5 cr</span>grade 9</span>
            </li>
            <li className="row-selected flex items-baseline justify-between py-3 pl-7 pr-3">
              <span><span className="block text-sm font-medium">Selected row</span><span className="block text-[13px] text-muted">Neutral fill, accent dot</span></span>
              <span className="num text-right text-muted"><span className="block text-fg">2.5 cr</span>grade 11</span>
            </li>
            <li className="flex items-baseline justify-between py-3">
              <span><span className="block text-sm font-medium">Financial Literacy</span><span className="block text-[13px] text-muted">Business · College prep</span></span>
              <span className="num text-right text-muted"><span className="block text-fg">2.5 cr</span>grade 10</span>
            </li>
          </ul>
        </Section>

        <Section title="Inputs and progress">
          <div className="flex max-w-md flex-col gap-4">
            <input className="input" placeholder="Search courses" />
            <select className="input"><option>All departments</option></select>
            <div className="h-1 overflow-hidden rounded-full bg-elevated">
              <div className="h-full w-2/3 bg-accent" />
            </div>
          </div>
        </Section>

        <Section title="Sign-in texture" description="Used on sign-in and onboarding controls only.">
          <div className="flex max-w-xs flex-col gap-3">
            <input className="input auth-texture" placeholder="Checkerboard input" />
            <Button className="auth-texture w-full">Continue with Google</Button>
          </div>
        </Section>
      </div>
    </main>
  );
}
