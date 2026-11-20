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

for (const action of ["Clear board", "Clear ink"]) {
  test(action + " confirms without form submission and cancel preserves content", async () => {
    const { runInNewContext } = await import("node:vm");
    await exec(process.execPath, ["scripts/build-v8-hosted.mjs"], { cwd: root });
    const source = await readFile(new URL("assets/v8-hosted.js", root), "utf8");
    const dialogs = source.slice(source.indexOf("function hostedDialog"), source.indexOf("const hostedPrompt"));
    const reset = source.match(/async function resetBoardContent\(\).*?return true}/)[0];
    const inkHandler = source.split("document.getElementById('clearInkBtn').onclick=")[1].split(";document.getElementById('clearBoardBtn')")[0];
    const invoke = action === "Clear board" ? reset + ";resetBoardContent()" : "(" + inkHandler + ")()";
    for (const accept of [false, true]) {
      const elements = [];
      const document = {
        body: { append() {} },
        createElement(tag) {
          const events = {};
          const node = {
            tag, style: {}, append() {}, remove() {}, focus() {},
            addEventListener(name, fn) { events[name] = fn; },
            showModal() { this.open = true; },
            close(value) { this.returnValue = value; this.open = false; events.close(); },
          };
          elements.push(node);
          return node;
        },
      };
      const board = { name: "Workshop", background: "grid", items: ["frame"], ops: ["pen", "highlighter"], media: ["image"] };
      const calls = [];
      const result = runInNewContext(dialogs + invoke, {
        document, current: () => board, selectedIds: new Set(), selectedMedia: null,
        hist: () => calls.push("history"), setTool() {}, renderBoard() {}, redraw: () => calls.push("redraw"),
        save: () => calls.push("save"), toast() {},
      });
      const button = elements.find(node => node.textContent === (accept ? "OK" : "Cancel"));
      assert.equal(button.type, "button");
      button.onclick();
      await result;
      assert.deepEqual([board.items.length, board.ops.length, board.media.length], accept ? (action === "Clear ink" ? [1, 0, 1] : [0, 0, 0]) : [1, 2, 1]);
      assert.deepEqual(calls, accept ? (action === "Clear ink" ? ["history", "redraw", "save"] : ["history", "save"]) : []);
      assert.equal(board.name, "Workshop");
      assert.equal(board.background, "grid");
    }
  });
}
