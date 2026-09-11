import { expect, test } from "@playwright/test";

test("signs in, autosaves, reopens, and recovers a hosted board", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your workshop should still be useful tomorrow.",
    }),
  ).toBeVisible();

  await page.getByLabel("Display name").fill("Hosted QA");
  await page
    .getByLabel("Work email")
    .fill(`hosted-qa-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();

  const title = page.getByLabel("Board title");
  await expect(title).toHaveValue("My first hosted board");
  await expect(page.getByText("Durable alpha")).toBeVisible();

  await page.getByTitle("Add sticky note").click();
  await page.getByLabel("Note").fill("Persistent customer insight");
  await title.fill("M3.2 persistence proof");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.reload();
  await expect(title).toHaveValue("M3.2 persistence proof");
  await expect(page.getByText("Persistent customer insight")).toBeVisible();
  await expect(page.locator(".revision-label")).toHaveText("Revision 2");

  await page.getByRole("button", { name: "Restore" }).last().click();
  await expect(title).toHaveValue("My first hosted board");
  await expect(page.getByText("Persistent customer insight")).toHaveCount(0);
  await expect(page.locator(".revision-label")).toHaveText("Revision 3");
});
