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

async function createPlan(page: Page) {
  await page.goto("/plans");
  await page.getByRole("button", { name: "Create Plan A", exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/[^/]+$/);
  return page.url();
}

/** Adds English I to grade 9 and returns the credits the catalog lists for it. */
async function addEnglishI(page: Page) {
  await page.getByRole("region", { name: "Grade 9", exact: true }).getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a course" });
  await dialog.getByRole("textbox", { name: "Search courses", exact: true }).fill("English I");
  const row = dialog.getByRole("listitem").filter({ has: page.getByText("English I", { exact: true }) });
  const credits = (await row.getByText(/^[\d.]+ cr$/).textContent())!.replace(" cr", "");
  await clickAndSettle(page, row.getByRole("button", { name: "Add", exact: true }));
  const grade9 = page.getByRole("region", { name: "Grade 9", exact: true });
  await expect(grade9.getByText("English I", { exact: true })).toBeVisible();
  // The column's Add button comes back once the server has saved the change.
  await expect(grade9.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry change", exact: true })).toHaveCount(0);
  return credits;
}

async function deletePlan(page: Page, planUrl: string) {
  await page.goto(planUrl);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete for good", exact: true }).click();
  await expect(page).toHaveURL(/\/plans$/);
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
  const planUrl = await createPlan(page);
  const rail = page.getByRole("complementary", { name: "Graduation progress" });
  const total = rail.getByRole("img", { name: /^[\d.]+ of [\d.]+ credits$/ });
  await expect(total).toHaveAccessibleName(/^0 of [\d.]+ credits$/);
  const required = (await total.getAttribute("aria-label"))!.split(" of ")[1];

  const credits = await addEnglishI(page);
  await expect(total).toHaveAccessibleName(`${credits} of ${required}`);
  await page.reload();
  await expect(total).toHaveAccessibleName(`${credits} of ${required}`);

  await deletePlan(page, planUrl);
});

test("a student imports the synthetic fixture transcript", async ({ page }) => {
  await signIn(page, `smoke-import-${stamp()}@example.test`, "STUDENT");
  const planUrl = await createPlan(page);
  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import courses", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "From a transcript", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles("fixtures/transcript.pdf");
  await expect(page.getByRole("region", { name: "Review", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Add \d+ courses?$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Added \d+ courses?\./ })).toBeVisible();

  await page.goto(planUrl);
  const rail = page.getByRole("complementary", { name: "Graduation progress" });
  await expect(rail.getByRole("img", { name: /^[\d.]+ of [\d.]+ credits$/ })).not.toHaveAccessibleName(/^0 of /);
  await deletePlan(page, planUrl);
});

test("a student submits a placement review request", async ({ page }) => {
  await signIn(page, `smoke-appeal-${stamp()}@example.test`, "STUDENT");
  // The course page only offers a review once the student has a plan to check against.
  const planUrl = await createPlan(page);
  await page.goto("/courses/chamber-choir");
  await page.getByRole("button", { name: "Request placement review", exact: true }).click();
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

  // Leave the reviewers' queue as it was.
  await page.getByRole("button", { name: "Withdraw request", exact: true }).click();
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
  await deletePlan(page, planUrl);
});

test("a counselor approves a plan a student sent for review", async ({ page }) => {
  const id = stamp();
  const student = `smoke-review-${id}`;
  await signIn(page, `${student}@example.test`, "STUDENT");
  const planUrl = await createPlan(page);
  await addEnglishI(page);
  const review = page.getByRole("region", { name: "Review", exact: true });
  await review.getByRole("button", { name: "Send for review", exact: true }).click();
  await expect(review.getByRole("button", { name: "Take it back to edit", exact: true })).toBeVisible();
  await expect(page.getByText("In review", { exact: true })).toBeVisible();

  await signIn(page, `smoke-counselor-${id}@pascack.org`, "COUNSELOR");
  await page.goto("/counselor");
  await page.getByRole("link", { name: new RegExp(`^${student} · Plan A`) }).click();
  await expect(page).toHaveURL(/\/counselor\/plans\/[^/]+$/);
  await page.getByRole("region", { name: "Review", exact: true }).getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();

  // The student sees the approval, then the synthetic plan is removed.
  await signIn(page, `${student}@example.test`, "STUDENT");
  await page.goto(planUrl);
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await deletePlan(page, planUrl);
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
