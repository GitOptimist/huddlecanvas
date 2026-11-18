import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const root = new URL("../", import.meta.url);

test("hosted build preserves v8 capabilities while exposing only truthful hosted controls", async () => {
  await exec(process.execPath, ["scripts/build-v8-hosted.mjs"], { cwd: root });
  const [source, hosted, bridge] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("assets/v8-hosted.html", root), "utf8"),
    readFile(new URL("assets/v8-hosted.js", root), "utf8"),
  ]);
  const sourceMarkup = source.replace(/<script>[\s\S]*?<\/script>/, "");
  const hostedMarkup = hosted.replace(
    '<script src="/v8-hosted.js"></script>',
    "",
  );
  const ids = (markup) =>
    [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]).sort();
  const sourceIds = ids(sourceMarkup);
  const hostedIds = ids(hostedMarkup);
  const hostedOnlyIds = [
    "hostedSidebar",
    "mobileSidebarBtn",
    "sidebarBackdrop",
  ];
  assert.deepEqual(
    hostedIds.filter((id) => !hostedOnlyIds.includes(id)),
    sourceIds,
  );
  assert.deepEqual(
    hostedIds.filter((id) => !sourceIds.includes(id)),
    hostedOnlyIds,
  );
  assert.match(hosted, /<script src="\/v8-hosted\.js"><\/script>/);
  assert.doesNotMatch(bridge, /localStorage/);
  assert.match(bridge, /type:'huddle:ready'/);
  assert.match(bridge, /type:'huddle:save'/);
  assert.match(bridge, /type!=='huddle:init'/);
  assert.match(bridge, /setAttribute\('aria-pressed'/);
  assert.match(bridge, /Canvas workspace/);
  assert.match(bridge, /MutationObserver\(enhanceCanvasItems\)/);
  assert.match(bridge, /baseToggleModal/);
  assert.match(bridge, /cancel\.onclick=\(\)=>close\('cancel'\)/);
  assert.doesNotMatch(
    bridge,
    /improveHostedAccessibility\(\);\s*\n\s*\(\(\)=>/,
  );
  assert.match(
    bridge,
    /toggleModal=improveHostedAccessibility\(\{toggleModal,current,selectItem/,
  );
  assert.match(bridge, /it\.type==='quiz'/);
  assert.match(bridge, /'QUIZ'/);
  assert.match(hosted, /id="aiBtn"[^>]*hidden/);
  assert.match(hosted, /id="collabBtn"[^>]*hidden/);
  assert.match(hosted, /id="bringEveryoneBtn"[^>]*hidden/);
  assert.match(hosted, /data-command="ai"[^>]*hidden/);
  assert.match(hosted, /saved workspace/);
  assert.match(hosted, /Signed-in workspace|signed-in account/i);
  assert.match(hosted, /@mentions are labels only/);
  assert.match(hosted, /Single-account preview/);
  assert.match(hosted, /aria-label="Reset view"/);
  assert.match(hosted, /aria-label="Expand timer"/);
  assert.match(hosted, /id="mobileSidebarBtn"/);
  assert.match(hosted, /aria-label="Workspace navigation"/);
  assert.match(hosted, /Single-account tools for workshops/);
  const combined = `${hosted}\n${bridge}`;
  for (const unsupportedCopy of [
    /HuddleCanvas AI/i,
    /AI Copilot/i,
    /AI QUIZ/i,
    /portable mode/i,
    /local prototype/i,
    /backend required/i,
    /a hosted version can/i,
    /portable build/i,
  ]) {
    assert.doesNotMatch(combined, unsupportedCopy);
  }
  await exec(process.execPath, ["scripts/build-v8-hosted.mjs"], { cwd: root });
  assert.equal(
    await readFile(new URL("assets/v8-hosted.html", root), "utf8"),
    hosted,
  );
  assert.equal(
    await readFile(new URL("assets/v8-hosted.js", root), "utf8"),
    bridge,
  );
  await exec(process.execPath, ["--check", "assets/v8-hosted.js"], {
    cwd: root,
  });
});
