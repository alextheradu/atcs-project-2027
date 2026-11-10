import { expect, test, type Page } from "@playwright/test";

// Pathways inside Classes: one subject's map at a time, drawn like the Program of Studies charts.

async function signIn(page: Page) {
  const response = await page.request.get(`/api/dev-login?email=pathways-${Date.now()}-${test.info().workerIndex}@example.test&role=STUDENT`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
}

test("a student reads how levels work, switches maps, and opens a class", async ({ page }) => {
  await signIn(page);
  await page.goto("/pathways");
  await expect(page).toHaveURL(/\/courses\?view=pathways$/);
  await expect(page.getByRole("heading", { name: "How levels work" })).toBeVisible();
  await expect(page.getByText("Move up a level", { exact: true })).toBeVisible();

  // Math starts from Algebra I in 8th grade.
  const algebra = page.getByRole("group", { name: "Math, starting from Algebra I in 8th grade" });
  await expect(algebra.getByRole("link", { name: "Honors Geometry, Honors", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moving levels in math" })).toBeVisible();

  await page.getByRole("link", { name: "Pre-Algebra", exact: true }).click();
  await expect(page).toHaveURL(/start=prealgebra/);
  const prealgebra = page.getByRole("group", { name: "Math, starting from Pre-Algebra in 8th grade" });
  await expect(prealgebra.getByRole("link", { name: "Algebra I Enhanced, Enhanced", exact: true })).toBeVisible();
  await expect(prealgebra.getByRole("link", { name: /^Honors Geometry/ })).toHaveCount(0);

  await page.getByRole("link", { name: "World language", exact: true }).click();
  await page.getByRole("link", { name: "French", exact: true }).click();
  await expect(page.getByRole("group", { name: "French" }).getByRole("link", { name: "Honors French III, Honors", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Science", exact: true }).click();
  await page.getByRole("group", { name: "Science" }).getByRole("link", { name: "Honors Chemistry, Honors", exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/honors-chemistry$/);
});

test("an unknown subject falls back to math", async ({ page }) => {
  await signIn(page);
  await page.goto("/courses?view=pathways&subject=nope&start=calculus");
  await expect(page.getByRole("group", { name: "Math, starting from Algebra I in 8th grade" })).toBeVisible();
});
