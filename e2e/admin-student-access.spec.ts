import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const response = await page.request.get(`/api/dev-login?email=admin-student-access-${Date.now()}-${test.info().workerIndex}@example.test&role=ADMIN`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
});

test("admins can use student navigation, import courses and manage their own placement draft", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/board$/);
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const item of ["Board", "Classes", "Students", "Admin"]) await expect(nav.getByRole("link", { name: new RegExp(`^${item}\\b`) })).toBeVisible();
  await page.locator('header button[aria-haspopup="true"]').click();
  await expect(page.getByRole("link", { name: "Import transcript", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(page.getByText(/^[\d.]+ of [\d.]+ credits\./)).toBeVisible();

  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import courses", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Add by hand", exact: true }).click();
  await page.getByRole("combobox", { name: "Course", exact: true }).fill("English I");
  await page.getByRole("button", { name: "Add 1 course", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added 1 course." })).toBeVisible();
  await page.goto("/board");
  await expect(page.getByRole("group", { name: "English, 9th grade", exact: true }).getByRole("button", { name: /^English I, / })).toBeVisible();

  await page.goto("/import");
  await page.getByRole("tab", { name: "From a transcript", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles("fixtures/transcript.pdf");
  await expect(page.getByRole("region", { name: "Review", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Add \d+ courses?$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Added \d+ courses?\./ })).toBeVisible();

  await page.goto("/pathways");
  await expect(page).toHaveURL(/\/courses\?view=pathways$/);
  await page.goto("/courses/chamber-choir");
  await page.getByRole("button", { name: "Ask for a placement review", exact: true }).click();
  await expect(page).toHaveURL(/\/appeals\/[^/]+$/);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await expect(page).toHaveURL(/\/appeals$/);
});

test("optional onboarding sets up an admin's plan without losing admin access", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "What grade are you in?", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "I am 13 or older", exact: true }).check();
  await page.getByRole("button", { name: "9th", exact: true }).click();
  await page.getByRole("checkbox", { name: "I have read the privacy policy and terms and I agree.", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("combobox", { name: "Math in 8th grade", exact: true }).selectOption("ALGEBRA_I");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Intended major or career", exact: true }).fill("Engineering");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Open my board", exact: true }).click();
  await expect(page).toHaveURL(/\/board\?tour=1$/);
  await expect(page.getByText(/^[\d.]+ of [\d.]+ credits\./)).toBeVisible();
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Users", exact: true })).toBeVisible();
});
