import { expect, test } from "@playwright/test";

test("co-requisite timing survives draft recovery, saving and reloading", async ({ page }) => {
  const response = await page.request.get("/api/dev-login?email=corequisite-admin@example.test&role=ADMIN");
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();

  await page.goto("/admin/catalog/new");
  await page.getByLabel("Name", { exact: true }).fill("Synthetic co-requisite course");
  const slug = `synthetic-corequisite-${Date.now()}`;
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("11", { exact: true }).check();
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog\/(?!new)[^/]+$/);
  const catalogUrl = page.url();
  const id = catalogUrl.split("/").pop();

  try {
    await page.goto(`/admin/rules/${id}`);
    await page.getByLabel("Add a requirement", { exact: true }).selectOption("coreq");
    const timing = page.getByRole("combobox", { name: "When to take it", exact: true });
    await expect(timing).toHaveValue("sameYear");
    await page.getByRole("combobox", { name: "Add a course", exact: true }).fill("AP Macroeconomics");
    await page.reload();
    await expect(timing).toHaveValue("sameYear");
    await expect(page.getByRole("button", { name: "Remove AP Macroeconomics", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save rules", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.reload();
    await expect(timing).toHaveValue("sameYear");

    await timing.selectOption("sameOrEarlier");
    await page.getByRole("button", { name: "Save rules", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.reload();
    await expect(timing).toHaveValue("sameOrEarlier");
    await page.goto(`/courses/${slug}`);
    await expect(page.getByRole("heading", { name: "Course requirements", exact: true })).toBeVisible();
    await expect(page.getByText("AP Macroeconomics in the same year or earlier", { exact: true })).toBeVisible();
  } finally {
    await page.goto(catalogUrl);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/catalog$/);
  }
});

test("the planner warns for a missing or split economics pair and clears warnings when reunited", async ({ page }) => {
  page.setDefaultTimeout(5000);
  const response = await page.request.get(`/api/dev-login?email=corequisite-student-${Date.now()}@example.test&role=STUDENT`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
  await page.goto("/plans");
  await page.getByRole("button", { name: "Create Plan A", exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/[^/]+$/);

  const year = (grade: number) => page.getByRole("region", { name: `Grade ${grade}`, exact: true });
  const warnings = page.getByRole("heading", { name: "Heads up", exact: true }).locator("..");
  const coWarnings = warnings.getByText(/same school year/);
  const dialog = page.getByRole("dialog", { name: "Add a course", exact: true });
  const add = async (name: string) => {
    await year(11).getByRole("button", { name: "Add", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Search courses", exact: true }).fill(name);
    await dialog.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(year(11).getByRole("button", { name: `Drag ${name}`, exact: true })).toBeEnabled();
  };

  try {
    await add("AP Microeconomics");
    await expect(coWarnings).toHaveCount(1);
    await add("AP Macroeconomics");
    await expect(coWarnings).toHaveCount(0);
    await year(11).getByRole("button", { name: /^AP Macroeconomics/ }).click();
    await year(11).getByRole("combobox", { name: "Move to grade", exact: true }).selectOption("12");
    await expect(coWarnings).toHaveCount(2);
    await expect(year(12).getByRole("button", { name: "Drag AP Macroeconomics", exact: true })).toBeEnabled();
    await page.reload();
    await expect(coWarnings).toHaveCount(2);
    await year(12).getByRole("button", { name: /^AP Macroeconomics/ }).click();
    await year(12).getByRole("combobox", { name: "Move to grade", exact: true }).selectOption("11");
    await expect(coWarnings).toHaveCount(0);
    await expect(year(11).getByRole("button", { name: "Drag AP Macroeconomics", exact: true })).toBeEnabled();
    await year(11).getByRole("button", { name: /^AP Macroeconomics/ }).click();
    await year(11).getByRole("button", { name: "Remove", exact: true }).click();
    await expect(coWarnings).toHaveCount(1);
  } finally {
    if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete for good", exact: true }).click();
    await expect(page).toHaveURL(/\/plans$/);
  }
});
