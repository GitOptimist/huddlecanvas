import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildV8Preview } from "./build-v8-preview.mjs";

test("preview build publishes the exact v8 HTML without hosted app assets", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "huddlecanvas-v8-preview-"));
  try {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const path = await buildV8Preview(root, temporary);
    assert.deepEqual(
      await readFile(path),
      await readFile(join(root, "index.html")),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
