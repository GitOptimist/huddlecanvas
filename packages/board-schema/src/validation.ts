import {
  CURRENT_SCHEMA_VERSION,
  type BoardDocument,
  type BoardObject,
  type ConnectorEndpoint,
  type ID,
  type ValidationIssue,
  type ValidationResult,
} from "./types.ts";

const objectTypes = new Set([
  "stroke",
  "shape",
  "text",
  "sticky",
  "media",
  "action",
  "checklist",
  "quiz",
  "connector",
  "frame",
  "group",
]);

const shapeKinds = new Set([
  "line",
  "rectangle",
  "rounded-rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "hexagon",
  "star",
]);

const MAX_BOARD_OBJECTS = 10_000;
const MAX_STROKE_POINTS = 200_000;
const MAX_ID_LENGTH = 512;
const MAX_TEXT_LENGTH = 100_000;
const MAX_CANVAS_VALUE = 1_000_000;
const MAX_ISSUES = 100;

interface ValidationBudget {
  strokePoints: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoundedNumber = (
  value: unknown,
  maximum = MAX_CANVAS_VALUE,
): value is number =>
  isFiniteNumber(value) && Math.abs(value) <= maximum;

const isBoundedString = (
  value: unknown,
  maximum = MAX_TEXT_LENGTH,
): value is string =>
  typeof value === "string" && value.length <= maximum;

const add = (
  issues: ValidationIssue[],
  path: string,
  code: string,
  message: string,
) => {
  if (issues.length < MAX_ISSUES) issues.push({ path, code, message });
};

function validateEndpoint(
  value: unknown,
  path: string,
  objectIds: Set<ID>,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    add(
      issues,
      path,
      "invalid_endpoint",
      "Connector endpoint must be an object.",
    );
    return;
  }
  if (value.kind === "point") {
    if (!isBoundedNumber(value.x) || !isBoundedNumber(value.y)) {
      add(
        issues,
        path,
        "invalid_point",
        "Point endpoints require finite x and y values.",
      );
    }
    return;
  }
  if (value.kind === "binding") {
    if (
      !isBoundedString(value.objectId, MAX_ID_LENGTH) ||
      !objectIds.has(value.objectId)
    ) {
      add(
        issues,
        `${path}.objectId`,
        "dangling_binding",
        "Bound object does not exist.",
      );
    }
    if (
      !["top", "right", "bottom", "left", "center"].includes(
        String(value.anchor),
      )
    ) {
      add(
        issues,
        `${path}.anchor`,
        "invalid_anchor",
        "Connector anchor is not supported.",
      );
    }
    return;
  }
  add(
    issues,
    `${path}.kind`,
    "invalid_endpoint_kind",
    "Endpoint must be a point or binding.",
  );
}

function validateObjectShape(
  value: unknown,
  key: string,
  objectIds: Set<ID>,
  issues: ValidationIssue[],
  budget: ValidationBudget,
): value is BoardObject {
  const path = `objects.${key}`;
  if (!isRecord(value)) {
    add(issues, path, "invalid_object", "Board object must be a record.");
    return false;
  }
  if (!isBoundedString(key, MAX_ID_LENGTH))
    add(issues, path, "invalid_id", "Object id is too long.");
  if (value.id !== key)
    add(
      issues,
      `${path}.id`,
      "id_mismatch",
      "Object id must match its record key.",
    );
  if (typeof value.type !== "string" || !objectTypes.has(value.type)) {
    add(
      issues,
      `${path}.type`,
      "unknown_object_type",
      "Unknown board object type.",
    );
    return false;
  }
  if (
    value.parentId !== null &&
    !isBoundedString(value.parentId, MAX_ID_LENGTH)
  ) {
    add(
      issues,
      `${path}.parentId`,
      "invalid_parent",
      "Parent id must be a string or null.",
    );
  }
  if (typeof value.parentId === "string" && !objectIds.has(value.parentId)) {
    add(
      issues,
      `${path}.parentId`,
      "missing_parent",
      "Parent object does not exist.",
    );
  }
  if (
    typeof value.orderKey !== "string" ||
    value.orderKey.length === 0 ||
    value.orderKey.length > MAX_ID_LENGTH
  ) {
    add(
      issues,
      `${path}.orderKey`,
      "invalid_order",
      "Order key must be a non-empty string.",
    );
  }
  if (!isRecord(value.transform)) {
    add(
      issues,
      `${path}.transform`,
      "invalid_transform",
      "Transform is required.",
    );
  } else {
    for (const field of ["x", "y", "rotation", "scaleX", "scaleY"] as const) {
      if (!isBoundedNumber(value.transform[field])) {
        add(
          issues,
          `${path}.transform.${field}`,
          "invalid_number",
          `${field} must be finite.`,
        );
      }
    }
    if (
      value.transform.scaleX === 0 ||
      value.transform.scaleY === 0 ||
      Math.abs(Number(value.transform.scaleX)) > 1_000 ||
      Math.abs(Number(value.transform.scaleY)) > 1_000
    ) {
      add(
        issues,
        `${path}.transform`,
        "zero_scale",
        "Scale values cannot be zero.",
      );
    }
  }
  if (
    !isRecord(value.size) ||
    !isBoundedNumber(value.size.width) ||
    !isBoundedNumber(value.size.height)
  ) {
    add(
      issues,
      `${path}.size`,
      "invalid_size",
      "Size requires finite width and height.",
    );
  } else if (value.size.width < 0 || value.size.height < 0) {
    add(issues, `${path}.size`, "negative_size", "Size cannot be negative.");
  }
  for (const field of ["locked", "hidden"] as const) {
    if (typeof value[field] !== "boolean")
      add(
        issues,
        `${path}.${field}`,
        "invalid_boolean",
        `${field} must be boolean.`,
      );
  }
  for (const field of [
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
  ] as const) {
    if (
      typeof value[field] !== "string" ||
      value[field].length === 0 ||
      value[field].length > MAX_ID_LENGTH
    ) {
      add(
        issues,
        `${path}.${field}`,
        "invalid_metadata",
        `${field} must be a non-empty string.`,
      );
    }
  }

  switch (value.type) {
    case "stroke":
      if (!Array.isArray(value.points) || value.points.length < 2) {
        add(
          issues,
          `${path}.points`,
          "invalid_points",
          "A stroke needs at least two points.",
        );
      } else {
        budget.strokePoints += value.points.length;
        if (budget.strokePoints > MAX_STROKE_POINTS) {
          add(
            issues,
            `${path}.points`,
            "too_many_points",
            "Board stroke point limit exceeded.",
          );
        }
        value.points.forEach((point, index) => {
          if (
            !isRecord(point) ||
            !isBoundedNumber(point.x) ||
            !isBoundedNumber(point.y) ||
            (point.pressure !== undefined &&
              (!isFiniteNumber(point.pressure) ||
                point.pressure < 0 ||
                point.pressure > 1)) ||
            (point.time !== undefined && !isBoundedNumber(point.time, 1e15))
          ) {
            add(
              issues,
              `${path}.points.${index}`,
              "invalid_point",
              "Stroke points require bounded coordinates and optional pressure/time values.",
            );
          }
        });
      }
      if (
        !isRecord(value.style) ||
        !isBoundedString(value.style.color, 128) ||
        !isFiniteNumber(value.style.width) ||
        value.style.width <= 0 ||
        value.style.width > 1_000 ||
        !isFiniteNumber(value.style.opacity) ||
        value.style.opacity < 0 ||
        value.style.opacity > 1
      )
        add(
          issues,
          `${path}.style`,
          "invalid_style",
          "Stroke style requires a color, positive width, and opacity from zero to one.",
        );
      break;
    case "shape":
      if (!shapeKinds.has(String(value.shape)))
        add(
          issues,
          `${path}.shape`,
          "invalid_shape",
          "Shape kind is not supported.",
        );
      if (
        !isRecord(value.style) ||
        !isBoundedString(value.style.stroke, 128) ||
        !isFiniteNumber(value.style.strokeWidth) ||
        value.style.strokeWidth < 0 ||
        value.style.strokeWidth > 1_000 ||
        (value.style.fill !== null &&
          !isBoundedString(value.style.fill, 128)) ||
        !isFiniteNumber(value.style.opacity) ||
        value.style.opacity < 0 ||
        value.style.opacity > 1
      )
        add(
          issues,
          `${path}.style`,
          "invalid_style",
          "Shape style contains invalid stroke, fill, width, or opacity values.",
        );
      break;
    case "text":
      if (
        !isBoundedString(value.text) ||
        !isRecord(value.style) ||
        !isBoundedString(value.style.color, 128) ||
        !isBoundedString(value.style.fontFamily, 256) ||
        !isFiniteNumber(value.style.fontSize) ||
        value.style.fontSize <= 0 ||
        value.style.fontSize > 1_000 ||
        ![400, 500, 600, 700, 800].includes(Number(value.style.fontWeight)) ||
        !["left", "center", "right"].includes(String(value.style.textAlign)) ||
        !isBoundedString(value.altText)
      )
        add(
          issues,
          path,
          "invalid_text",
          "Text content, style, and alt text are required.",
        );
      break;
    case "sticky":
      if (!isBoundedString(value.text) || !isBoundedString(value.color, 128))
        add(
          issues,
          path,
          "invalid_sticky",
          "Sticky text and color are required.",
        );
      break;
    case "media":
      if (
        !isBoundedString(value.assetId, MAX_ID_LENGTH) ||
        !isBoundedString(value.altText)
      )
        add(
          issues,
          path,
          "invalid_media",
          "Media asset id and alt text are required.",
        );
      break;
    case "action":
      if (
        !isBoundedString(value.title) ||
        !["open", "in-progress", "done", "blocked"].includes(
          String(value.status),
        )
      )
        add(
          issues,
          path,
          "invalid_action",
          "Action title and status are required.",
        );
      if (
        value.assigneeId !== undefined &&
        !isBoundedString(value.assigneeId, MAX_ID_LENGTH)
      )
        add(
          issues,
          `${path}.assigneeId`,
          "invalid_assignee",
          "Action assignee id is invalid.",
        );
      if (
        value.dueAt !== undefined &&
        (typeof value.dueAt !== "string" ||
          Number.isNaN(Date.parse(value.dueAt)))
      )
        add(
          issues,
          `${path}.dueAt`,
          "invalid_due_date",
          "Action due date must be an ISO-compatible timestamp.",
        );
      break;
    case "checklist":
      if (!isBoundedString(value.title) || !Array.isArray(value.rows))
        add(
          issues,
          path,
          "invalid_checklist",
          "Checklist title and rows are required.",
        );
      if (Array.isArray(value.rows)) {
        const rowIds = new Set<string>();
        value.rows.forEach((row, index) => {
          if (
            !isRecord(row) ||
            !isBoundedString(row.id, MAX_ID_LENGTH) ||
            !isBoundedString(row.text) ||
            typeof row.done !== "boolean"
          ) {
            add(
              issues,
              `${path}.rows.${index}`,
              "invalid_checklist_row",
              "Checklist rows require an id, text, and completion state.",
            );
            return;
          }
          if (rowIds.has(row.id))
            add(
              issues,
              `${path}.rows.${index}.id`,
              "duplicate_row_id",
              "Checklist row ids must be unique.",
            );
          rowIds.add(row.id);
        });
      }
      break;
    case "quiz":
      if (
        !isBoundedString(value.prompt) ||
        !Array.isArray(value.options) ||
        !["hidden", "revealed"].includes(String(value.answerPolicy))
      )
        add(
          issues,
          path,
          "invalid_quiz",
          "Quiz prompt, options, and answer policy are required.",
        );
      if (Array.isArray(value.options)) {
        const optionIds = new Set<string>();
        value.options.forEach((option, index) => {
          if (
            !isRecord(option) ||
            !isBoundedString(option.id, MAX_ID_LENGTH) ||
            !isBoundedString(option.text)
          ) {
            add(
              issues,
              `${path}.options.${index}`,
              "invalid_quiz_option",
              "Quiz options require an id and text.",
            );
            return;
          }
          if (optionIds.has(option.id))
            add(
              issues,
              `${path}.options.${index}.id`,
              "duplicate_option_id",
              "Quiz option ids must be unique.",
            );
          optionIds.add(option.id);
        });
        if (
          value.correctOptionId !== undefined &&
          (typeof value.correctOptionId !== "string" ||
            !optionIds.has(value.correctOptionId))
        )
          add(
            issues,
            `${path}.correctOptionId`,
            "missing_correct_option",
            "The correct option must reference an option on this quiz.",
          );
      }
      break;
    case "connector":
      validateEndpoint(
        value.start as ConnectorEndpoint,
        `${path}.start`,
        objectIds,
        issues,
      );
      validateEndpoint(
        value.end as ConnectorEndpoint,
        `${path}.end`,
        objectIds,
        issues,
      );
      if (!["straight", "orthogonal", "curved"].includes(String(value.routing)))
        add(
          issues,
          `${path}.routing`,
          "invalid_routing",
          "Connector routing is not supported.",
        );
      if (
        !isRecord(value.style) ||
        !isBoundedString(value.style.color, 128) ||
        !isFiniteNumber(value.style.width) ||
        value.style.width <= 0 ||
        value.style.width > 1_000 ||
        !["none", "arrow"].includes(String(value.style.endMarker))
      )
        add(
          issues,
          `${path}.style`,
          "invalid_style",
          "Connector style contains invalid color, width, or end marker values.",
        );
      break;
    case "frame":
      if (!isBoundedString(value.title))
        add(
          issues,
          `${path}.title`,
          "invalid_title",
          "Frame title is required.",
        );
      if (
        value.presentationOrder !== undefined &&
        (!Number.isInteger(value.presentationOrder) ||
          Number(value.presentationOrder) < 0)
      )
        add(
          issues,
          `${path}.presentationOrder`,
          "invalid_presentation_order",
          "Presentation order must be a non-negative integer.",
        );
      break;
    case "group":
      if (
        !Array.isArray(value.childIds) ||
        value.childIds.some((id) => !isBoundedString(id, MAX_ID_LENGTH))
      )
        add(
          issues,
          `${path}.childIds`,
          "invalid_children",
          "Group child ids must be strings.",
        );
      break;
  }
  return true;
}

function validateHierarchy(
  document: BoardDocument,
  issues: ValidationIssue[],
): void {
  const rootIds = new Set(document.rootOrder);
  if (rootIds.size !== document.rootOrder.length)
    add(
      issues,
      "rootOrder",
      "duplicate_root",
      "Root order cannot contain duplicates.",
    );

  for (const id of document.rootOrder) {
    const object = document.objects[id];
    if (!object)
      add(
        issues,
        "rootOrder",
        "missing_root",
        `Root object ${id} does not exist.`,
      );
    else if (object.parentId !== null)
      add(
        issues,
        `objects.${id}.parentId`,
        "root_has_parent",
        "Root objects cannot have a parent.",
      );
  }

  for (const object of Object.values(document.objects)) {
    if (object.parentId === null && !rootIds.has(object.id))
      add(
        issues,
        `objects.${object.id}`,
        "unreachable_object",
        "Root-level object is missing from root order.",
      );
    if (object.parentId !== null) {
      const parent = document.objects[object.parentId];
      if (parent && parent.type !== "group" && parent.type !== "frame")
        add(
          issues,
          `objects.${object.id}.parentId`,
          "invalid_parent_type",
          "Only groups and frames may contain objects.",
        );
      if (parent?.type === "group" && !parent.childIds.includes(object.id))
        add(
          issues,
          `objects.${object.id}.parentId`,
          "parent_child_mismatch",
          "The parent group does not list this child.",
        );
    }
    if (object.type === "group") {
      if (new Set(object.childIds).size !== object.childIds.length)
        add(
          issues,
          `objects.${object.id}.childIds`,
          "duplicate_child",
          "Group children cannot repeat.",
        );
      for (const childId of object.childIds) {
        if (document.objects[childId]?.parentId !== object.id)
          add(
            issues,
            `objects.${object.id}.childIds`,
            "child_parent_mismatch",
            `Child ${childId} does not reference this group.`,
          );
      }
    }
  }

  const siblingOrderKeys = new Map<string, Set<string>>();
  for (const object of Object.values(document.objects)) {
    const parentKey = object.parentId ?? "$root";
    const keys = siblingOrderKeys.get(parentKey) ?? new Set<string>();
    if (keys.has(object.orderKey))
      add(
        issues,
        `objects.${object.id}.orderKey`,
        "duplicate_sibling_order",
        "Sibling objects must have unique order keys.",
      );
    keys.add(object.orderKey);
    siblingOrderKeys.set(parentKey, keys);
  }

  for (const start of Object.values(document.objects)) {
    const seen = new Set<ID>([start.id]);
    let parentId = start.parentId;
    while (parentId !== null) {
      if (seen.has(parentId)) {
        add(
          issues,
          `objects.${start.id}.parentId`,
          "hierarchy_cycle",
          "Object hierarchy contains a cycle.",
        );
        break;
      }
      seen.add(parentId);
      parentId = document.objects[parentId]?.parentId ?? null;
    }
  }
}

export function validateBoardDocument(
  input: unknown,
): ValidationResult<BoardDocument> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input))
    return {
      ok: false,
      issues: [
        {
          path: "$",
          code: "invalid_document",
          message: "Board document must be an object.",
        },
      ],
    };
  if (input.schemaVersion !== CURRENT_SCHEMA_VERSION)
    add(
      issues,
      "schemaVersion",
      "unsupported_schema",
      `Expected schema version ${CURRENT_SCHEMA_VERSION}.`,
    );
  if (
    typeof input.boardId !== "string" ||
    input.boardId.length === 0 ||
    input.boardId.length > MAX_ID_LENGTH
  )
    add(issues, "boardId", "invalid_id", "Board id is required.");
  if (!Number.isInteger(input.generation) || Number(input.generation) < 0)
    add(
      issues,
      "generation",
      "invalid_generation",
      "Generation must be a non-negative integer.",
    );
  if (!isBoundedString(input.title, 500))
    add(issues, "title", "invalid_title", "Board title must be a string.");
  if (
    !isRecord(input.settings) ||
    !isRecord(input.settings.background) ||
    !isRecord(input.settings.snap)
  )
    add(issues, "settings", "invalid_settings", "Board settings are required.");
  else {
    const { background, snap } = input.settings;
    if (
      !["solid", "grid", "dots"].includes(String(background.kind)) ||
      !isBoundedString(background.color, 128) ||
      background.color.length === 0
    )
      add(
        issues,
        "settings.background",
        "invalid_background",
        "Background requires a supported kind and color.",
      );
    if (
      typeof snap.enabled !== "boolean" ||
      !isFiniteNumber(snap.gridSize) ||
      snap.gridSize <= 0 ||
      snap.gridSize > MAX_CANVAS_VALUE
    )
      add(
        issues,
        "settings.snap",
        "invalid_snap_settings",
        "Snap settings require an enabled state and positive grid size.",
      );
  }
  if (!isRecord(input.objects))
    add(
      issues,
      "objects",
      "invalid_objects",
      "Objects must be an id-keyed record.",
    );
  else if (Object.keys(input.objects).length > MAX_BOARD_OBJECTS)
    add(
      issues,
      "objects",
      "too_many_objects",
      `A board may contain at most ${MAX_BOARD_OBJECTS} objects.`,
    );
  if (
    !Array.isArray(input.rootOrder) ||
    input.rootOrder.some((id) => !isBoundedString(id, MAX_ID_LENGTH)) ||
    input.rootOrder.length > MAX_BOARD_OBJECTS
  )
    add(
      issues,
      "rootOrder",
      "invalid_root_order",
      "Root order must be an array of ids.",
    );

  if (isRecord(input.objects)) {
    const objectIds = new Set(Object.keys(input.objects));
    const budget: ValidationBudget = { strokePoints: 0 };
    for (const [key, value] of Object.entries(input.objects))
      validateObjectShape(value, key, objectIds, issues, budget);
  }

  if (issues.length === 0)
    validateHierarchy(input as unknown as BoardDocument, issues);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: structuredClone(input) as unknown as BoardDocument,
    issues: [],
  };
}

export function assertBoardDocument(input: unknown): BoardDocument {
  const result = validateBoardDocument(input);
  if (!result.ok) {
    const detail = result.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid HuddleCanvas board document:\n${detail}`);
  }
  return result.value;
}
