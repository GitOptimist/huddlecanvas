import { expect, test } from "@playwright/test";

test("saves the working v8 interface to one hosted account and isolates another", async ({
  page,
}) => {
  const firstEmail = `v8-hosted-${Date.now()}@example.com`;
  await page.goto("/");
  await page.getByLabel("Display name").fill("V8 Hosted QA");
  await page.getByLabel("Work email").fill(firstEmail);
  await page.getByRole("button", { name: "Continue to workspace" }).click();

  const frame = page.frameLocator('iframe[title="HuddleCanvas board"]');
  const title = frame.locator("#boardTitle");
  await expect(title).toHaveValue("My first board");
  await expect(frame.locator("#stickyBtn")).toBeVisible();

  await title.fill("Hosted v8 proof");
  await frame.locator("#stickyBtn").click();
  await frame.locator('[data-sticky-color="#fff2a8"]').click();
  await frame.locator("#drawCanvas").click({ position: { x: 520, y: 360 } });
  await frame
    .locator(".sticky textarea")
    .fill("This exact v8 board survived a cloud reload");
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved to your account", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(title).toHaveValue("Hosted v8 proof");
  await expect(frame.locator(".sticky textarea")).toHaveValue(
    "This exact v8 board survived a cloud reload",
  );

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await page.getByLabel("Display name").fill("Second Account QA");
  await page
    .getByLabel("Work email")
    .fill(`v8-other-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await expect(frame.locator("#boardTitle")).toHaveValue("My first board");
  await expect(frame.locator(".sticky textarea")).toHaveCount(0);
});
