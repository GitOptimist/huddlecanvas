import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("saves a video without contacting its provider until explicitly loaded", async ({ page }) => {
  let loads = 0;
  await page.route("https://player.vimeo.com/**", route => {
    loads++;
    return route.fulfill({ contentType: "text/html", body: "<title>Test player</title>" });
  });
  await page.goto("/");
  await page.getByLabel("Display name").fill("Video QA");
  await page.getByLabel("Work email").fill(`video-${randomUUID()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  const board = page.frameLocator('iframe[title="HuddleCanvas board"]');
  await board.locator("#boardTitle").press("Control+k");
  await board.getByRole("button", { name: "Add video link" }).click();
  await board.getByRole("textbox", { name: /video URL/ }).fill("https://vimeo.com/123456");
  await board.getByRole("button", { name: "Add to board" }).click();
  const load = board.getByRole("button", { name: "Load video" });
  await expect(load).toBeVisible();
  await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();
  await page.reload();
  await expect(load).toBeVisible();
  expect(loads).toBe(0);
  await load.click();
  await expect.poll(() => loads).toBe(1);
});
