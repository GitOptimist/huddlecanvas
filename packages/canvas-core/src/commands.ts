import type {
  BoardDocument,
  BoardObject,
  ConnectorEndpoint,
  ConnectorObject,
  FrameObject,
  GroupObject,
  ID,
  Size,
} from "@huddlecanvas/board-schema";

export type BoardCommand =
  | { type: "object.add"; object: BoardObject }
  | { type: "object.remove"; objectIds: ID[] }
  | { type: "object.move"; objectIds: ID[]; deltaX: number; deltaY: number }
  | { type: "object.resize"; objectId: ID; size: Size }
  | { type: "object.lock"; objectIds: ID[]; locked: boolean }
  | { type: "object.reparent"; objectId: ID; parentId: ID | null }
  | { type: "object.reorder"; objectId: ID; beforeId: ID | null }
  | { type: "board.rename"; title: string };

export interface CommandContext {
  actorId: ID;
  now: string;
}

export class CommandError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CommandError";
    this.code = code;
  }
}

const isContainer = (
  object: BoardObject,
): object is GroupObject | FrameObject =>
  object.type === "group" || object.type === "frame";

const touch = (object: BoardObject, context: CommandContext): void => {
  object.updatedAt = context.now;
  object.updatedBy = context.actorId;
};

const orderKey = (index: number): string => index.toString().padStart(8, "0");

function requireObject(board: BoardDocument, id: ID): BoardObject {
  const object = board.objects[id];
  if (!object)
    throw new CommandError(`Object '${id}' was not found.`, "object.not_found");
  return object;
}

function assertMutable(object: BoardObject): void {
  if (object.locked) {
    throw new CommandError(`Object '${object.id}' is locked.`, "object.locked");
  }
}

function siblings(board: BoardDocument, parentId: ID | null): ID[] {
  if (parentId === null) return [...board.rootOrder];
  const parent = requireObject(board, parentId);
  if (parent.type === "group") return [...parent.childIds];
  return Object.values(board.objects)
    .filter((object) => object.parentId === parentId)
    .sort(
      (a, b) =>
        a.orderKey.localeCompare(b.orderKey) || a.id.localeCompare(b.id),
    )
    .map((object) => object.id);
}

function writeSiblingOrder(
  board: BoardDocument,
  parentId: ID | null,
  ids: ID[],
): void {
  if (parentId === null) board.rootOrder = ids;
  else {
    const parent = requireObject(board, parentId);
    if (parent.type === "group") parent.childIds = ids;
  }
  ids.forEach((id, index) => {
    if (board.objects[id]) board.objects[id].orderKey = orderKey(index);
  });
}

function removeFromParent(board: BoardDocument, object: BoardObject): void {
  const ids = siblings(board, object.parentId).filter((id) => id !== object.id);
  writeSiblingOrder(board, object.parentId, ids);
}

function addToParent(
  board: BoardDocument,
  object: BoardObject,
  parentId: ID | null,
): void {
  const ids = siblings(board, parentId);
  if (!ids.includes(object.id)) ids.push(object.id);
  object.parentId = parentId;
  writeSiblingOrder(board, parentId, ids);
}

function endpointPosition(
  endpoint: ConnectorEndpoint,
  board: BoardDocument,
): { x: number; y: number } {
  if (endpoint.kind === "point") return endpoint;
  const target = requireObject(board, endpoint.objectId);
  const width = target.size.width * target.transform.scaleX;
  const height = target.size.height * target.transform.scaleY;
  const center = {
    x: target.transform.x + width / 2,
    y: target.transform.y + height / 2,
  };
  switch (endpoint.anchor) {
    case "top":
      return { x: center.x, y: target.transform.y };
    case "right":
      return { x: target.transform.x + width, y: center.y };
    case "bottom":
      return { x: center.x, y: target.transform.y + height };
    case "left":
      return { x: target.transform.x, y: center.y };
    default:
      return center;
  }
}

function detachDeletedBindings(
  connector: ConnectorObject,
  boardBeforeDelete: BoardDocument,
  deleted: Set<ID>,
  context: CommandContext,
): void {
  let changed = false;
  if (
    connector.start.kind === "binding" &&
    deleted.has(connector.start.objectId)
  ) {
    connector.start = {
      kind: "point",
      ...endpointPosition(connector.start, boardBeforeDelete),
    };
    changed = true;
  }
  if (connector.end.kind === "binding" && deleted.has(connector.end.objectId)) {
    connector.end = {
      kind: "point",
      ...endpointPosition(connector.end, boardBeforeDelete),
    };
    changed = true;
  }
  if (changed) touch(connector, context);
}

function wouldCreateCycle(
  board: BoardDocument,
  objectId: ID,
  parentId: ID,
): boolean {
  let cursor: ID | null = parentId;
  const visited = new Set<ID>();
  while (cursor) {
    if (cursor === objectId) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = board.objects[cursor]?.parentId ?? null;
  }
  return false;
}

function applyAdd(board: BoardDocument, object: BoardObject): void {
  if (board.objects[object.id]) {
    throw new CommandError(
      `Object '${object.id}' already exists.`,
      "object.duplicate_id",
    );
  }
  if (object.parentId !== null) {
    const parent = requireObject(board, object.parentId);
    if (!isContainer(parent)) {
      throw new CommandError(
        "Objects can only be parented by a frame or group.",
        "parent.invalid_type",
      );
    }
  }
  const added = structuredClone(object);
  board.objects[object.id] = added;
  addToParent(board, added, object.parentId);
}

function applyRemove(
  board: BoardDocument,
  objectIds: ID[],
  context: CommandContext,
): void {
  const deleted = new Set(objectIds);
  for (const id of deleted) assertMutable(requireObject(board, id));

  const beforeDelete = structuredClone(board);
  for (const id of deleted) {
    const object = board.objects[id];
    if (!object) continue;
    const children = Object.values(board.objects).filter(
      (candidate) => candidate.parentId === id && !deleted.has(candidate.id),
    );
    const formerParentId = object.parentId;
    removeFromParent(board, object);
    for (const child of children) {
      child.parentId = formerParentId;
      touch(child, context);
      addToParent(board, child, formerParentId);
    }
    delete board.objects[id];
  }

  for (const object of Object.values(board.objects)) {
    if (object.type === "group") {
      object.childIds = object.childIds.filter(
        (id) => !deleted.has(id) && Boolean(board.objects[id]),
      );
    }
    if (object.type === "connector")
      detachDeletedBindings(object, beforeDelete, deleted, context);
  }
  board.rootOrder = board.rootOrder.filter(
    (id) => !deleted.has(id) && Boolean(board.objects[id]),
  );
}

function applyReparent(
  board: BoardDocument,
  objectId: ID,
  parentId: ID | null,
  context: CommandContext,
): void {
  const object = requireObject(board, objectId);
  assertMutable(object);
  if (parentId !== null) {
    const parent = requireObject(board, parentId);
    assertMutable(parent);
    if (!isContainer(parent)) {
      throw new CommandError(
        "Objects can only be parented by a frame or group.",
        "parent.invalid_type",
      );
    }
    if (wouldCreateCycle(board, objectId, parentId)) {
      throw new CommandError(
        "That parent would create a hierarchy cycle.",
        "parent.cycle",
      );
    }
  }
  removeFromParent(board, object);
  addToParent(board, object, parentId);
  touch(object, context);
}

export function applyBoardCommand(
  document: BoardDocument,
  command: BoardCommand,
  context: CommandContext,
): BoardDocument {
  const board = structuredClone(document);
  switch (command.type) {
    case "object.add":
      applyAdd(board, command.object);
      break;
    case "object.remove":
      applyRemove(board, command.objectIds, context);
      break;
    case "object.move":
      for (const id of command.objectIds) {
        const object = requireObject(board, id);
        assertMutable(object);
        object.transform.x += command.deltaX;
        object.transform.y += command.deltaY;
        touch(object, context);
      }
      break;
    case "object.resize": {
      const object = requireObject(board, command.objectId);
      assertMutable(object);
      if (command.size.width <= 0 || command.size.height <= 0) {
        throw new CommandError(
          "Object dimensions must be greater than zero.",
          "size.invalid",
        );
      }
      object.size = { ...command.size };
      touch(object, context);
      break;
    }
    case "object.lock":
      for (const id of command.objectIds) {
        const object = requireObject(board, id);
        object.locked = command.locked;
        touch(object, context);
      }
      break;
    case "object.reparent":
      applyReparent(board, command.objectId, command.parentId, context);
      break;
    case "object.reorder": {
      const object = requireObject(board, command.objectId);
      assertMutable(object);
      const ordered = siblings(board, object.parentId).filter(
        (id) => id !== object.id,
      );
      const index =
        command.beforeId === null
          ? ordered.length
          : ordered.indexOf(command.beforeId);
      if (index < 0) {
        throw new CommandError(
          "The reorder target is not a sibling.",
          "order.invalid_target",
        );
      }
      ordered.splice(index, 0, object.id);
      writeSiblingOrder(board, object.parentId, ordered);
      touch(object, context);
      break;
    }
    case "board.rename":
      if (!command.title.trim())
        throw new CommandError(
          "Board title cannot be empty.",
          "board.empty_title",
        );
      board.title = command.title.trim();
      break;
  }
  board.generation += 1;
  return board;
}
