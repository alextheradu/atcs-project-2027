import Link from "next/link";
import { Row, Rows, Section } from "@/components/ui/page";
import { HILLS_COUNSELING, VALLEY_COUNSELING, hillsCounselorForName } from "@/lib/counselor/contact";

const link = "font-medium text-accent-ink underline-offset-4 hover:underline";

export function SpecialCases({ studentName }: { studentName: string | null }) {
  const counselor = hillsCounselorForName(studentName);

  return (
    <div className="space-y-8">
      <Section
        split
        title="Special cases"
        description="Planning options and details that the 2026–2027 Program of Studies only partly covers. Confirm current availability and graduation credit with your counselor."
      >
        <Rows>
          <Row
            title="Financial Literacy"
            description={
              <ul className="space-y-1">
                <li><Link className={link} href="/courses/financial-literacy">Half-year elective</Link> · No final exam</li>
                <li><Link className={link} href="/courses/financial-literacy-hybrid">Hybrid</Link> · Final exam required</li>
                <li>Summer · No final exam. Ask your counselor about registration.</li>
              </ul>
            }
          />
          <Row
            title="Zero Period Gym"
            description="If you have an internship, you may be able to take PE before the school day to meet your physical education requirement. Ask your counselor whether Zero Period Gym is offered and fits your schedule."
          />
          <Row
            title="Advanced courses over the summer"
            description="Students may be able to get ahead in a core subject through a summer course at an outside school. These courses can be demanding and typically cost more than $500. Pascack Hills does not offer this option directly. Ask your teacher or math supervisor Dr. Jessica Nuzzi for a recommendation and confirm that the school will accept the course before enrolling."
          />
          <Row
            title="Pascack Period"
            description="A period for independent study. You may need to schedule it alongside certain science courses."
          />
          <Row
            title="Satellite School"
            description={<>A shared-time vocational program in Paramus. Ask your counselor how it fits your schedule and how credits count. <Link className={link} href="/courses/satellite-school">View Satellite School</Link></>}
          />
          <Row
            title="Virtual High School"
            description={<>An online option for courses unavailable at your school. Ask your counselor about enrollment and credit. <Link className={link} href="/courses/virtual-high-school-vhs">View Virtual High School</Link></>}
          />
        </Rows>
      </Section>
      <Section split title="Counselor contact" description="Ask about scheduling, enrollment or credits.">
        <div className="flex flex-col items-start gap-2 text-[15px]">
          {counselor && <a className={link} href={`mailto:${counselor.email}`}>Email {counselor.name} (Pascack Hills)</a>}
          <a className={link} href={HILLS_COUNSELING}>Pascack Hills counselor directory</a>
          <a className={link} href={VALLEY_COUNSELING}>Pascack Valley counselor directory</a>
        </div>
      </Section>
    </div>
  );
}
