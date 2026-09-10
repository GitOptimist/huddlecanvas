import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthorizationError,
  assertCapability,
  can,
  capabilitiesFor,
} from "./index.ts";

test("owners receive every product capability", () => {
  assert.equal(capabilitiesFor("owner").length, 9);
  assert.equal(can("owner", "board.delete"), true);
  assert.equal(can("owner", "version.restore"), true);
});

test("editors can facilitate but cannot share, delete, or restore", () => {
  assert.equal(can("editor", "board.facilitate"), true);
  assert.equal(can("editor", "board.share"), false);
  assert.equal(can("editor", "board.delete"), false);
  assert.equal(can("editor", "version.restore"), false);
});

test("viewers are read-only", () => {
  assert.deepEqual(capabilitiesFor("viewer"), ["board.read"]);
  assert.throws(
    () => assertCapability("viewer", "board.edit"),
    (error) => error instanceof AuthorizationError,
  );
});

test("guest sessions can vote without receiving durable edit access", () => {
  assert.equal(can("guest-session", "board.vote"), true);
  assert.equal(can("guest-session", "board.edit"), false);
  assert.equal(can("guest-session", "board.comment"), false);
});
