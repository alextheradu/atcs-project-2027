import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MiniBoard } from "@/components/landing/mini-board";
import { SignInCard } from "@/components/sign-in-card";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/nav";

async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return null;
}

const FRAME = "mx-auto w-full max-w-[1180px] px-5 md:px-8";
const SPLIT = "grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16";
const SIGN_IN_LINK = "inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline";

const PLANNING_STEPS = [
  {
    title: "Build your Board",
    description: "Add classes you’ve taken and classes you want to take. The Board puts subjects in rows and grades 9 through 12 in columns, so you can see all four years together.",
  },
  {
    title: "See what you still need to graduate",
    description: "Your credit totals update as you edit. An outlined space in a subject row shows where you still need a class, and selecting it brings up options that count toward that requirement.",
  },
  {
    title: "Find a class you can take next",
    description: "Browse Classes to see prerequisites from the Program of Studies and how they apply to you. Use Pathways to see what usually comes next, or request a placement review when one is available.",
  },
];

const QUESTIONS = [
  {
    question: "Do I need a transcript to get started?",
    answer: "You can start with a blank Board and add past classes by hand. If you have a PDF transcript, you can import it later and review the classes before adding them.",
  },
  {
    question: "Can I start in eighth grade?",
    answer: "If you’re 13 or older, choose eighth grade after signing in. A few questions about your classes and interests help the planner build a starter draft for ninth grade.",
  },
  {
    question: "Does the planner enroll me in classes?",
    answer: "Use your Board to explore options and talk them through with your counselor. Your school handles course selection and makes final placement decisions.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>

      <a href="#content" className="skip-link">Skip to content</a>
      <header className={`${FRAME} flex min-h-16 flex-wrap items-center justify-between gap-x-4`}>
        <span className="text-[16px] font-bold tracking-[-0.02em]">Course Planner</span>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 sm:gap-x-7">
          <a href="#how-it-works" className="inline-flex min-h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
            How it works
          </a>
          <a href="#sign-in" className={SIGN_IN_LINK}>Sign in</a>
        </nav>
      </header>

      <main id="content" tabIndex={-1}>
        <section aria-labelledby="landing-title" className={`${FRAME} ${SPLIT} pb-16 pt-8 sm:pb-20 sm:pt-12 lg:items-center lg:pb-24 lg:pt-16`}>
          <div>
            <h1 id="landing-title" className="max-w-[15ch] text-[40px] font-bold leading-[1.04] tracking-[-0.035em] md:text-[52px]">
              Your whole <span className="whitespace-nowrap">high school</span> plan on one Board.
            </h1>
            <p className="mt-5 max-w-[42ch] text-[17px] leading-relaxed text-muted">
              Plan your classes at Pascack Hills or Pascack Valley. See what you still need to graduate and what you can take next.
            </p>

            <div id="sign-in" tabIndex={-1} className="mt-8 max-w-[400px] scroll-mt-6 rounded-[14px]">
              <Suspense fallback={<div className="soft h-[210px]" />}>
                <SignInCard />
              </Suspense>
            </div>
          </div>
          <MiniBoard />
        </section>

        <section id="how-it-works" aria-labelledby="how-it-works-title" tabIndex={-1} className={`${FRAME} ${SPLIT} scroll-mt-6 pb-16 sm:pb-20 lg:pb-24`}>
          <h2 id="how-it-works-title" className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">
            How it works
          </h2>
          <ol className="num list-decimal space-y-7 ps-6 marker:font-semibold marker:text-muted lg:-ms-2 lg:ps-0">
            {PLANNING_STEPS.map(({ title, description }) => (
              <li key={title} className="ps-2">
                <h3 className="text-[20px] font-bold leading-snug">{title}</h3>
                <p className="mt-2 max-w-[58ch] text-base leading-relaxed text-muted">{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="questions-title" className="bg-fill">
          <div className={`${FRAME} ${SPLIT} py-14 sm:py-20`}>
            <h2 id="questions-title" className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">
              Before you start
            </h2>
            <div>
              <dl className="space-y-7">
                {QUESTIONS.map(({ question, answer }) => (
                  <div key={question}>
                    <dt className="text-[20px] font-bold leading-snug">{question}</dt>
                    <dd className="mt-2 max-w-[58ch] text-base leading-relaxed text-muted">{answer}</dd>
                  </div>
                ))}
              </dl>
              <a href="#sign-in" className={`${SIGN_IN_LINK} mt-5`}>
                Sign in to start your Board <span aria-hidden="true">↑</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={`${FRAME} flex flex-wrap items-center justify-between gap-x-6 py-6`}>
        <p className="text-[13px] text-muted">
          An unofficial tool. Not affiliated with the Pascack Valley Regional High School District.
        </p>
        <nav aria-label="Legal" className="flex gap-4 text-[13px]">
          <Link href="/privacy" className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-fg hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-fg hover:underline">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  );
}
