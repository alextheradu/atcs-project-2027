import { expect, test, type Page } from "@playwright/test";

// Staff home. Accounts are synthetic and unique per run.

async function signIn(page: Page, role: string, extra = "") {
  const response = await page.request.get(`/api/dev-login?email=students-${role.toLowerCase()}-${Date.now()}-${test.info().workerIndex}@pascack.org&role=${role}${extra}`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
}

const views = (page: Page) => page.getByRole("navigation", { name: "Students view" });

test("a counselor lands on Students with review, gaps and demand", async ({ page }) => {
  await signIn(page, "COUNSELOR");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/students$/);
  for (const label of ["Needs a look", "Graduation gaps", "Course demand"]) {
    await expect(views(page).getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Plans sent for review", exact: true })).toBeVisible();
  await views(page).getByRole("link", { name: /^Course demand/ }).click();
  await expect(page).toHaveURL(/tab=demand/);
  await expect(page.getByRole("link", { name: "Most students", exact: true })).toBeVisible();
});

test("a supervisor sees only placement reviews", async ({ page }) => {
  await signIn(page, "SUPERVISOR", "&dept=MATH");
  await page.goto("/students");
  await expect(page.getByRole("heading", { name: "Placement reviews to decide", exact: true })).toBeVisible();
  await expect(views(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Plans sent for review", exact: true })).toHaveCount(0);
  // Asking for a hidden tab falls back to the default.
  await page.goto("/students?tab=demand");
  await expect(page.getByRole("heading", { name: "Placement reviews to decide", exact: true })).toBeVisible();
});

test("old staff pages redirect, and hidden admin tabs stay refused", async ({ page }) => {
  await signIn(page, "COUNSELOR");
  await page.goto("/counselor");
  await expect(page).toHaveURL(/\/students$/);
  await page.goto("/board");
  await expect(page).toHaveURL(/\/students$/);
  // The app shell streams, so a refusal shows the not-found page rather than a 404 status.
  await page.goto("/admin/rules");
  await expect(page.getByRole("heading", { name: "This page is out of reach." })).toBeVisible();

  await signIn(page, "SUPERVISOR", "&dept=MATH");
  await page.goto("/review");
  await expect(page).toHaveURL(/\/students$/);
  await page.goto("/admin/catalog");
  await expect(page.getByRole("heading", { name: "This page is out of reach." })).toBeVisible();
});

test("students are refused the staff pages", async ({ page }) => {
  await signIn(page, "STUDENT");
  for (const path of ["/students", "/admin", "/admin/catalog", "/counselor/plans/doesnotexist123"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "This page is out of reach." })).toBeVisible();
  }
});

test("a counselor looking at a student's board is not offered the student's placement review", async ({ page }) => {
  const student = `students-viewed-${Date.now()}-${test.info().workerIndex}`;
  const response = await page.request.get(`/api/dev-login?email=${student}@example.test&role=STUDENT`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(page.getByText(/^[\d.]+ of [\d.]+ credits\./)).toBeVisible();
  await page.goto("/courses/chamber-choir");
  await page.getByRole("button", { name: "Add to my board", exact: true }).click();
  await expect(page.getByText(/^On your board in/)).toBeVisible();
  await page.goto("/board");
  const tile = page.getByRole("group", { name: /grade$/ }).getByRole("button", { name: /^Chamber Choir, / });
  await tile.click();
  await expect(page.getByRole("dialog", { name: "Chamber Choir" }).getByRole("button", { name: "Ask for a placement review", exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: "Chamber Choir" }).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("region", { name: "Review", exact: true }).getByRole("button", { name: "Send for review", exact: true }).click();
  await expect(page.getByText("In review", { exact: true })).toBeVisible();

  await signIn(page, "COUNSELOR");
  await page.goto("/students");
  await page.getByRole("link", { name: new RegExp(`^${student} sent`) }).click();
  await expect(page).toHaveURL(/\/counselor\/plans\/[^/]+$/);
  await page.getByRole("group", { name: /grade$/ }).getByRole("button", { name: /^Chamber Choir, / }).click();
  const sheet = page.getByRole("dialog", { name: "Chamber Choir" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Ask for a placement review", exact: true })).toHaveCount(0);
});
