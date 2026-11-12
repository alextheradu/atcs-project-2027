import { expect, test, type Locator, type Page } from "@playwright/test";

// Phase 11 smoke tests. Every account is synthetic and unique per run. Sign-in uses the
// dev-only bypass, which returns 404 unless NODE_ENV is development or test and DEV_AUTH=true.

const stamp = () => `${Date.now()}-${test.info().workerIndex}`;

async function signIn(page: Page, email: string, role: string, extra = "") {
  const response = await page.request.get(`/api/dev-login?email=${encodeURIComponent(email)}&role=${role}${extra}`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
}

/** Clicks something that calls a server action and waits for the server to answer. */
async function clickAndSettle(page: Page, target: Locator) {
  const answered = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
  await target.click();
  await answered;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const status = (page: Page) => page.getByText(/^[\d.]+ of [\d.]+ credits\./);

/** Every student has one plan, shown on the Board. */
async function startBoard(page: Page) {
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(status(page)).toBeVisible();
}

/** Adds English I to 9th grade and returns the credits the catalog lists for it. */
async function addEnglishI(page: Page) {
  await page.getByRole("button", { name: "Add a class", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a course" });
  await dialog.getByRole("combobox", { name: "Grade to add to", exact: true }).selectOption("9");
  await dialog.getByRole("textbox", { name: "Search courses", exact: true }).fill("English I");
  const row = dialog.getByRole("listitem").filter({ has: page.getByText("English I", { exact: true }) });
  const credits = (await row.getByText(/^[\d.]+ cr$/).textContent())!.replace(" cr", "");
  await clickAndSettle(page, row.getByRole("button", { name: "Add", exact: true }));
  await expect(dialog.getByRole("status")).toHaveText("Added English I to 9th grade");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("group", { name: "English, 9th grade", exact: true }).getByRole("button", { name: new RegExp(`^${escape("English I")}, `) })).toBeVisible();
  // The Add button comes back once the server has saved the change.
  await expect(page.getByRole("button", { name: "Add a class", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Retry change", exact: true })).toHaveCount(0);
  return credits;
}

test("landing page asks for age before sign-in, and onboarding asks again", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  const google = page.getByRole("button", { name: "Continue with Google", exact: true });
  await expect(google).toBeDisabled();
  // The answer is stored as a cookie by a server action, so wait for it before clearing cookies.
  await clickAndSettle(page, page.getByRole("button", { name: "13 or older", exact: true }));
  await expect(google).toBeEnabled();

  await page.context().clearCookies();
  await page.reload();
  await clickAndSettle(page, page.getByRole("button", { name: "Under 13", exact: true }));
  await expect(page.getByRole("status").filter({ hasText: "Come back when you are 13." })).toBeVisible();
  await expect(google).toHaveCount(0);

  // A fresh browser (no age cookie) signs in and has to confirm age inside onboarding.
  await page.context().clearCookies();
  await signIn(page, `smoke-age-${stamp()}@example.test`, "STUDENT", "&onboarding=1");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "What grade are you in?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "9th", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Confirm that you are 13 or older." })).toBeVisible();
  await page.getByRole("checkbox", { name: "I am 13 or older", exact: true }).check();
  await page.getByRole("button", { name: "9th", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Privacy and terms", exact: true })).toBeVisible();
});

test("a student builds a plan and the credit total updates", async ({ page }) => {
  await signIn(page, `smoke-plan-${stamp()}@example.test`, "STUDENT");
  await startBoard(page);
  await expect(status(page)).toHaveText(/^0 of [\d.]+ credits\./);
  const required = (await status(page).textContent())!.match(/of ([\d.]+) credits/)![1];

  const credits = await addEnglishI(page);
  await expect(status(page)).toHaveText(new RegExp(`^${escape(credits)} of ${escape(required)} credits\\.`));
  await page.reload();
  await expect(status(page)).toHaveText(new RegExp(`^${escape(credits)} of ${escape(required)} credits\\.`));
});

test("a student imports the synthetic fixture transcript", async ({ page }) => {
  await signIn(page, `smoke-import-${stamp()}@example.test`, "STUDENT");
  await startBoard(page);
  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import courses", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "From a transcript", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles("fixtures/transcript.pdf");
  await expect(page.getByRole("region", { name: "Review", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Add \d+ courses?$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Added \d+ courses?\./ })).toBeVisible();

  await page.goto("/board");
  await expect(status(page)).not.toHaveText(/^0 of /);
});

test("a student submits a placement review request", async ({ page }) => {
  await signIn(page, `smoke-appeal-${stamp()}@example.test`, "STUDENT");
  // The course page only offers a review once the student has a plan to check against.
  await startBoard(page);
  await page.goto("/courses/chamber-choir");
  await page.getByRole("button", { name: "Ask for a placement review", exact: true }).click();
  await expect(page).toHaveURL(/\/appeals\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Chamber Choir", exact: true })).toBeVisible();

  // Answer every question the admins have configured, whatever they are.
  const form = page.locator("main form");
  for (const box of await form.getByRole("textbox").all()) await box.fill("Synthetic smoke test answer.");
  for (const select of await form.getByRole("combobox").all()) {
    if (await select.getByRole("option", { name: "Yes", exact: true }).count()) await select.selectOption("Yes");
  }
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic smoke test answer.").first()).toBeVisible();

  // The class page points back to the request, and so does the menu under the student's name.
  const appealUrl = page.url();
  await page.goto("/courses/chamber-choir");
  await expect(page.getByRole("link", { name: "Your placement review", exact: true })).toHaveAttribute("href", new URL(appealUrl).pathname);
  await page.locator('header button[aria-haspopup="true"]').click();
  await expect(page.getByRole("link", { name: "Placement reviews", exact: true })).toBeVisible();
  await page.goto(appealUrl);

  // Leave the reviewers' queue as it was.
  await page.getByRole("button", { name: "Withdraw request", exact: true }).click();
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
});

test("a counselor approves a plan a student sent for review", async ({ page }) => {
  const id = stamp();
  const student = `smoke-review-${id}`;
  await signIn(page, `${student}@example.test`, "STUDENT");
  await startBoard(page);
  await addEnglishI(page);
  const review = page.getByRole("region", { name: "Review", exact: true });
  await review.getByRole("button", { name: "Send for review", exact: true }).click();
  await expect(review.getByRole("button", { name: "Take it back to edit", exact: true })).toBeVisible();
  await expect(page.getByText("In review", { exact: true })).toBeVisible();

  await signIn(page, `smoke-counselor-${id}@pascack.org`, "COUNSELOR");
  await page.goto("/students");
  await page.getByRole("link", { name: new RegExp(`^${student} sent`) }).click();
  await expect(page).toHaveURL(/\/counselor\/plans\/[^/]+$/);
  await page.getByRole("region", { name: "Review", exact: true }).getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();

  // The student sees the approval on their board.
  await signIn(page, `${student}@example.test`, "STUDENT");
  await page.goto("/board");
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(page.getByText(/in review/)).toHaveCount(0);
});

test("a student requests deletion from settings and cancels it", async ({ page }) => {
  await signIn(page, `smoke-delete-${stamp()}@example.test`, "STUDENT");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my data", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check your notifications and email for the confirmation link." })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Nothing is deleted until you open it and confirm.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel the request", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Request cancelled." })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Delete my data", exact: true })).toBeVisible();
});
