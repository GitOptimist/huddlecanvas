import { expect, test } from "@playwright/test";

test("keeps the v8 shell usable on desktop and mobile", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByLabel("Display name").fill("Layout QA");
  await page.getByLabel("Work email").fill(`layout-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  const canvas = page.getByLabel("Canvas", { exact: true });
  await expect(canvas).toBeVisible();

  for (const width of [1440, 850, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const sidebar = page.getByRole("complementary", {
      name: "Workspace sidebar",
    });
    if (width <= 850) {
      await expect(sidebar).toBeHidden();
      await page.getByRole("button", { name: "Toggle sidebar" }).click();
      await expect(sidebar).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create board" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sidebar).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Toggle sidebar" }),
      ).toBeFocused();
    } else {
      await expect(sidebar).toBeVisible();
    }

    const before = await canvas.boundingBox();
    expect(before).not.toBeNull();
    expect(before!.height).toBeGreaterThan(850);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(
      page.getByRole("complementary", { name: "Selection and board history" }),
    ).toBeVisible();
    expect(await canvas.boundingBox()).toEqual(before);
    await page.getByRole("button", { name: "Close inspector" }).click();

    const rail = await page
      .getByRole("toolbar", { name: "Canvas tools" })
      .boundingBox();
    const header = await page.locator(".hosted-shell .topbar").boundingBox();
    expect(rail!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await testInfo.attach(`hosted-layout-${width}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
});
