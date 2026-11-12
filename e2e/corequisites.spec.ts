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
    await expect(page.getByRole("heading", { name: "What it takes", exact: true })).toBeVisible();
    await expect(page.getByText("AP Macroeconomics in the same year or earlier", { exact: true })).toBeVisible();
  } finally {
    await page.goto(catalogUrl);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/catalog$/);
  }
});

test("the board flags a missing or split economics pair and clears it when reunited", async ({ page }) => {
  page.setDefaultTimeout(5000);
  const response = await page.request.get(`/api/dev-login?email=corequisite-student-${Date.now()}@example.test&role=STUDENT`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(page.getByText(/^[\d.]+ of [\d.]+ credits\./)).toBeVisible();

  const year = (grade: number) => page.getByRole("group", { name: new RegExp(`, ${grade}th grade$`) });
  const tile = (grade: number, name: string) => year(grade).getByRole("button", { name: new RegExp(`^${name}, `) });
  // Only the desktop grid has groups, so the hidden phone layout is never counted twice.
  const flags = page.getByRole("group").getByText("Needs its partner class", { exact: true });
  const dialog = page.getByRole("dialog", { name: "Add a course", exact: true });
  const add = async (name: string) => {
    await page.getByRole("button", { name: "Add a class", exact: true }).click();
    await dialog.getByRole("combobox", { name: "Grade to add to", exact: true }).selectOption("11");
    await dialog.getByRole("textbox", { name: "Search courses", exact: true }).fill(name);
    await dialog.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Add", exact: true }).click();
    // The panel stays open after Add so several classes can go in at once.
    await expect(dialog.getByRole("status")).toHaveText(`Added ${name} to 11th grade`);
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(tile(11, name)).toBeEnabled();
    await expect(page.getByRole("button", { name: "Add a class", exact: true })).toBeEnabled();
  };
  const moveTo = async (from: number, to: number, name: string) => {
    await tile(from, name).click();
    await page.getByRole("dialog", { name }).getByRole("button", { name: `${to}th`, exact: true }).click();
    await expect(tile(to, name)).toBeVisible();
    await page.getByRole("dialog", { name }).getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add a class", exact: true })).toBeEnabled();
  };

  await add("AP Microeconomics");
  await expect(flags).toHaveCount(1);
  // Screen readers hear the warning as part of the tile's name.
  await expect(year(11).getByRole("button", { name: /^AP Microeconomics, .*Needs its partner class/ })).toBeVisible();
  await add("AP Macroeconomics");
  await expect(flags).toHaveCount(0);
  await moveTo(11, 12, "AP Macroeconomics");
  await expect(flags).toHaveCount(2);
  await page.reload();
  await expect(flags).toHaveCount(2);
  await moveTo(12, 11, "AP Macroeconomics");
  await expect(flags).toHaveCount(0);
  await tile(11, "AP Macroeconomics").click();
  const macroSheet = page.getByRole("dialog", { name: "AP Macroeconomics" });
  await macroSheet.getByRole("button", { name: "Remove from board", exact: true }).click();
  await macroSheet.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(flags).toHaveCount(1);
});
