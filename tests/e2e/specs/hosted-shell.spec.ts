import { expect, test } from "@playwright/test";

test("uses, persists, and recovers the hosted canvas", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Turn workshop ideas into action.",
    }),
  ).toBeVisible();

  await page.getByLabel("Display name").fill("Hosted QA");
  await page
    .getByLabel("Work email")
    .fill(`hosted-qa-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();

  const title = page.getByLabel("Board title");
  await expect(title).toHaveValue("My first hosted board");
  await expect(page.getByRole("button", { name: "Pen (P)" })).toBeVisible();

  const canvas = page.getByLabel("Canvas");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Canvas is not visible");

  await page.getByRole("button", { name: "Sticky note (S)" }).click();
  await page.mouse.click(canvasBox.x + 430, canvasBox.y + 310);
  await page
    .getByLabel("Note")
    .fill("Persistent customer insight about our users");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await title.fill("M3.5 canvas proof");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Pen (P)" }).click();
  await page.mouse.move(canvasBox.x + 520, canvasBox.y + 390);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 570, canvasBox.y + 420, { steps: 8 });
  await page.mouse.move(canvasBox.x + 620, canvasBox.y + 390, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "stroke object" })).toHaveCount(
    1,
  );

  await page.getByRole("button", { name: "Shapes (R)" }).click();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.mouse.click(canvasBox.x + 690, canvasBox.y + 330);
  await expect(page.getByRole("button", { name: "shape object" })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Close inspector" }).click();

  await page.getByRole("button", { name: "Text (T)" }).click();
  await page.mouse.click(canvasBox.x + 770, canvasBox.y + 440);
  await page
    .getByLabel("Text", { exact: true })
    .fill("A decision worth keeping");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(
    page.getByRole("button", { name: "Reset zoom and position" }),
  ).toHaveText("115%");

  await page.reload();
  await expect(title).toHaveValue("M3.5 canvas proof");
  await expect(
    page.getByText("Persistent customer insight about our users"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "stroke object" })).toHaveCount(
    1,
  );
  await expect(page.getByRole("button", { name: "shape object" })).toHaveCount(
    1,
  );
  await expect(page.getByText("A decision worth keeping")).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Restore" }).last().click();
  await expect(title).toHaveValue("My first hosted board");
  await expect(
    page.getByText("Persistent customer insight about our users"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "stroke object" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "shape object" })).toHaveCount(
    0,
  );
  await expect(page.getByText("A decision worth keeping")).toHaveCount(0);
});

test("selects, duplicates, moves, undoes and persists board objects", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Display name").fill("Parity QA");
  await page.getByLabel("Work email").fill(`parity-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();

  const canvas = page.getByLabel("Canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.getByRole("button", { name: "Sticky note (S)" }).click();
  await page.mouse.click(box.x + 360, box.y + 290);
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: "Sticky note (S)" }).click();
  await page.mouse.click(box.x + 570, box.y + 320);
  await page.getByRole("button", { name: "Close inspector" }).click();

  await page.mouse.move(box.x + 230, box.y + 190);
  await page.mouse.down();
  await page.mouse.move(box.x + 680, box.y + 420, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByRole("button", { name: "sticky object" })).toHaveCount(
    4,
  );
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.getByRole("button", { name: "sticky object" })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: /Redo/ }).click();
  await expect(page.getByRole("button", { name: "sticky object" })).toHaveCount(
    4,
  );

  const selected = page.locator(".hosted-object.selected").first();
  const selectedBox = await selected.boundingBox();
  if (!selectedBox) throw new Error("Selected object is not visible");
  await page.mouse.move(selectedBox.x + 40, selectedBox.y + 40);
  await page.mouse.down();
  await page.mouse.move(selectedBox.x + 80, selectedBox.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "sticky object" })).toHaveCount(
    4,
  );
  await page.getByRole("button", { name: "sticky object" }).first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "sticky object" })).toHaveCount(
    3,
  );
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("button", { name: "sticky object" })).toHaveCount(
    4,
  );
});

test("resizes, rotates, locks and unlocks one object through canonical history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Display name").fill("Transform QA");
  await page
    .getByLabel("Work email")
    .fill(`transform-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Continue to workspace" }).click();

  const canvas = page.getByLabel("Canvas");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Canvas is not visible");
  await page.getByRole("button", { name: "Sticky note (S)" }).click();
  await page.mouse.click(canvasBox.x + 480, canvasBox.y + 330);
  await page.getByRole("button", { name: "Close inspector" }).click();

  const object = page.getByRole("button", { name: "sticky object" });
  const geometry = () =>
    object.evaluate((element) => {
      const style = (element as HTMLElement).style;
      const rotation = /rotate\((-?[\d.]+)deg\)/.exec(style.transform);
      return {
        width: Number.parseFloat(style.width),
        height: Number.parseFloat(style.height),
        rotation: Number(rotation?.[1] ?? 0),
      };
    });
  const original = await geometry();
  const resize = page.getByRole("button", { name: "Resize selected object" });
  const resizeBox = await resize.boundingBox();
  if (!resizeBox) throw new Error("Resize handle is not visible");
  await page.mouse.move(
    resizeBox.x + resizeBox.width / 2,
    resizeBox.y + resizeBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 70, resizeBox.y + 45, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await geometry()).width)
    .toBeGreaterThan(original.width + 40);
  await expect
    .poll(async () => (await geometry()).height)
    .toBeGreaterThan(original.height + 20);
  const resized = await geometry();

  const rotate = page.getByRole("button", { name: "Rotate selected object" });
  const rotateBox = await rotate.boundingBox();
  const objectBox = await object.boundingBox();
  if (!rotateBox || !objectBox)
    throw new Error("Rotation handle is not visible");
  await page.mouse.move(
    rotateBox.x + rotateBox.width / 2,
    rotateBox.y + rotateBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(objectBox.x + objectBox.width + 35, objectBox.y + 45, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await geometry()).rotation)
    .toBeGreaterThan(15);
  await expect.poll(async () => (await geometry()).rotation).toBeLessThan(165);

  const pointerRotated = await geometry();
  await page
    .getByRole("button", { name: "Rotate selected object right 15 degrees" })
    .click();
  const keyboardRotated = {
    ...pointerRotated,
    rotation: (pointerRotated.rotation + 15) % 360,
  };
  await expect.poll(geometry).toEqual(keyboardRotated);
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect.poll(geometry).toEqual(pointerRotated);
  await page.getByRole("button", { name: /Redo/ }).click();
  await expect.poll(geometry).toEqual(keyboardRotated);

  await page
    .getByRole("button", { name: "Make selected object smaller" })
    .click();
  const smaller = {
    width: Math.max(32, Math.round(keyboardRotated.width * 0.9)),
    height: Math.max(32, Math.round(keyboardRotated.height * 0.9)),
    rotation: keyboardRotated.rotation,
  };
  await expect.poll(geometry).toEqual(smaller);
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect.poll(geometry).toEqual(keyboardRotated);

  expect(resized.width).toBeGreaterThan(original.width);
  expect(resized.height).toBeGreaterThan(original.height);

  await page
    .getByRole("button", {
      name: "Lock selection to prevent accidental edits",
    })
    .click();
  await expect(
    page.getByRole("button", { name: "sticky object, locked" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resize selected object" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(
    page.getByRole("button", { name: "sticky object" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Redo/ }).click();
  await expect(
    page.getByRole("button", { name: "sticky object, locked" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Unlock selection to allow editing" })
    .click();
  await expect(
    page.getByRole("button", { name: "sticky object" }),
  ).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const persisted = await geometry();
  await page.reload();
  const reloaded = page.getByRole("button", { name: "sticky object" });
  await expect
    .poll(() =>
      reloaded.evaluate((element) => {
        const style = (element as HTMLElement).style;
        const rotation = /rotate\((-?[\d.]+)deg\)/.exec(style.transform);
        return {
          width: Number.parseFloat(style.width),
          height: Number.parseFloat(style.height),
          rotation: Number(rotation?.[1] ?? 0),
        };
      }),
    )
    .toEqual(persisted);
});
