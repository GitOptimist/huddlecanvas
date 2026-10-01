import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const root = new URL("../", import.meta.url);

test("hosted build preserves the v8 document and replaces only persistence/startup wiring", async () => {
  await exec(process.execPath, ["scripts/build-v8-hosted.mjs"], { cwd: root });
  const [source, hosted, bridge] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("assets/v8-hosted.html", root), "utf8"),
    readFile(new URL("assets/v8-hosted.js", root), "utf8"),
  ]);
  const normalized = source.replaceAll("\n", "\n");
  const sourceWithoutScript = normalized.replace(
    /<script>[\s\S]*?<\/script>/,
    '<script src="/v8-hosted.js"></script>',
  );
  assert.equal(hosted, sourceWithoutScript);
  assert.doesNotMatch(bridge, /localStorage/);
  assert.match(bridge, /type:'huddle:ready'/);
  assert.match(bridge, /type:'huddle:save'/);
  assert.match(bridge, /type!=='huddle:init'/);
  await exec(process.execPath, ["--check", "assets/v8-hosted.js"], {
    cwd: root,
  });
});
