import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("saves the working v8 interface to one hosted account and isolates another", async ({
  page,
}) => {
  const firstEmail = `v8-hosted-${randomUUID()}@example.com`;
  await page.goto("/");
  await page.getByLabel("Display name").fill("V8 Hosted QA");
  await page.getByLabel("Work email").fill(firstEmail);
  await page.getByRole("button", { name: "Continue to workspace" }).click();

  const frame = page.frameLocator('iframe[title="HuddleCanvas board"]');
  const title = frame.locator("#boardTitle");
  await expect(title).toHaveValue("My first board");
  await expect(frame.locator("#stickyBtn")).toBeVisible();
  await expect(frame.locator("#aiBtn")).toBeHidden();
  await expect(frame.locator("#collabBtn")).toBeHidden();
  await expect(frame.locator("#bringEveryoneBtn")).toBeHidden();
  await expect(frame.locator("#resetView")).toHaveAttribute(
    "aria-label",
    "Reset view",
  );
  await expect(frame.locator('[data-tool="select"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await title.fill("Hosted v8 proof");
  await frame.locator("#stickyBtn").click();
  await frame.locator('[data-sticky-color="#fff2a8"]').click();
  await frame.locator("#drawCanvas").click({ position: { x: 520, y: 360 } });
  await frame
    .locator(".sticky textarea")
    .fill("This exact v8 board survived a cloud reload");
  const sticky = frame.locator(".sticky.canvasItem");
  await sticky.focus();
  await sticky.press("Enter");
  await expect(sticky).toHaveClass(/selected/);
  const originalLeft = await sticky.evaluate((element) =>
    Number.parseFloat((element as HTMLElement).style.left),
  );
  await sticky.press("ArrowRight");
  await expect
    .poll(() =>
      frame
        .locator(".sticky.canvasItem")
        .evaluate((element) =>
          Number.parseFloat((element as HTMLElement).style.left),
        ),
    )
    .toBe(originalLeft + 1);
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved to your account", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });

  await frame.locator("#facilitateBtn").click();
  await frame.locator("#resetBoardBtn").click();
  await expect(frame.locator("dialog")).toBeVisible();
  await expect(frame.locator("dialog")).toContainText("Reset this board?");
  await frame.getByRole("button", { name: "Cancel" }).click();

  await frame.locator("#exportBtn").click();
  await expect(frame.locator("#exportModal")).toHaveAttribute("role", "dialog");
  await expect(frame.locator("#exportModal")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(frame.locator("#downloadPdf")).toBeFocused();
  const downloadPromise = page.waitForEvent("download");
  await frame.locator("#downloadBoard").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.flowboard$/);
  await frame.locator("#exportClose").click();
  await expect(frame.locator("#exportBtn")).toBeFocused();

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
    .fill(`v8-other-${randomUUID()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await expect(frame.locator("#boardTitle")).toHaveValue("My first board");
  await expect(frame.locator(".sticky textarea")).toHaveCount(0);
});

test("keeps the default hosted v8 canvas usable at desktop and mobile widths", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByLabel("Display name").fill("V8 Layout QA");
  await page
    .getByLabel("Work email")
    .fill(`v8-layout-${randomUUID()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();

  const frame = page.frameLocator('iframe[title="HuddleCanvas board"]');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(frame.locator("#boardWrap")).toBeVisible();
    await expect(frame.locator("#stickyBtn")).toBeVisible();
    await expect(frame.locator("#aiBtn")).toBeHidden();
    if (width <= 850) {
      const mobileNavigation = frame.locator("#mobileSidebarBtn");
      await expect(mobileNavigation).toBeVisible();
      await mobileNavigation.click();
      await expect(frame.locator("body")).toHaveClass(/mobileSidebarOpen/);
      await expect
        .poll(async () => {
          const sidebarBox = await frame
            .locator("#hostedSidebar")
            .boundingBox();
          return sidebarBox?.x ?? Number.NEGATIVE_INFINITY;
        })
        .toBeGreaterThanOrEqual(-0.5);
      await expect(frame.locator("#newBoard")).toBeVisible();
      await frame.locator("#sidebarBackdrop").click({
        position: { x: width - 5, y: 5 },
      });
      await expect(frame.locator("body")).not.toHaveClass(/mobileSidebarOpen/);
    }
    const dimensions = await frame.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await testInfo.attach(`v8-hosted-layout-${width}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
});
