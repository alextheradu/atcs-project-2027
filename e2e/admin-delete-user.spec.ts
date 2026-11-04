import { expect, test } from "@playwright/test";

test("an admin deletes another account after typing its email", async ({ page }) => {
  const stamp = `${Date.now()}-${test.info().workerIndex}`;
  const student = `delete-target-${stamp}@example.test`;
  // Signing in creates the account. The admin sign-in that follows replaces the session cookie.
  const made = await page.request.get(`/api/dev-login?email=${student}&role=STUDENT`);
  test.skip(made.status() === 404, "dev login is off");
  await page.request.get(`/api/dev-login?email=delete-admin-${stamp}@example.test&role=ADMIN`);

  await page.goto(`/admin/users?q=${encodeURIComponent(student)}`);
  const row = page.locator("li", { hasText: student });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Delete" }).click();

  const confirm = row.getByRole("button", { name: "Delete permanently" });
  await expect(confirm).toBeDisabled();
  await row.getByRole("textbox", { name: `Type ${student} to confirm` }).fill("wrong@example.test");
  await expect(confirm).toBeDisabled();
  await row.getByRole("textbox", { name: `Type ${student} to confirm` }).fill(student);
  await confirm.click();

  await expect(page.getByText("No users found.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No users found.")).toBeVisible();

  await page.goto("/admin/deletions");
  await expect(page.getByText("Deleted by an admin").first()).toBeVisible();
});

test("an admin has no delete button on their own row", async ({ page }) => {
  const admin = `delete-self-${Date.now()}-${test.info().workerIndex}@example.test`;
  const made = await page.request.get(`/api/dev-login?email=${admin}&role=ADMIN`);
  test.skip(made.status() === 404, "dev login is off");
  await page.goto(`/admin/users?q=${encodeURIComponent(admin)}`);
  const row = page.locator("li", { hasText: admin });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("button", { name: "Delete" })).toHaveCount(0);
});
