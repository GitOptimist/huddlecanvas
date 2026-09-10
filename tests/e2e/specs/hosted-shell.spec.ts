import { expect, test } from "@playwright/test";

test("renders a candid and accessible model proof", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Q4 Product Planning" }),
  ).toBeVisible();
  await expect(page.getByText("Read-only model proof")).toBeVisible();
  await expect(
    page.getByText("No simulated collaboration or persistence."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Canvas tools preview").getByRole("button"),
  ).toHaveCount(6);
  await expect(
    page.getByLabel("Canvas tools preview").getByRole("button").first(),
  ).toBeDisabled();
});
