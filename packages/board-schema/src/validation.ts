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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const add = (
  issues: ValidationIssue[],
  path: string,
  code: string,
  message: string,
) => issues.push({ path, code, message });

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
    if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
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
    if (typeof value.objectId !== "string" || !objectIds.has(value.objectId)) {
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
): value is BoardObject {
  const path = `objects.${key}`;
  if (!isRecord(value)) {
    add(issues, path, "invalid_object", "Board object must be a record.");
    return false;
  }
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
  if (value.parentId !== null && typeof value.parentId !== "string") {
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
  if (typeof value.orderKey !== "string" || value.orderKey.length === 0) {
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
      if (!isFiniteNumber(value.transform[field])) {
        add(
          issues,
          `${path}.transform.${field}`,
          "invalid_number",
          `${field} must be finite.`,
        );
      }
    }
    if (value.transform.scaleX === 0 || value.transform.scaleY === 0) {
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
    !isFiniteNumber(value.size.width) ||
    !isFiniteNumber(value.size.height)
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
    if (typeof value[field] !== "string" || value[field].length === 0) {
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
      if (!Array.isArray(value.points) || value.points.length < 2)
        add(
          issues,
          `${path}.points`,
          "invalid_points",
          "A stroke needs at least two points.",
        );
      if (!isRecord(value.style))
        add(
          issues,
          `${path}.style`,
          "invalid_style",
          "Stroke style is required.",
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
      if (!isRecord(value.style))
        add(
          issues,
          `${path}.style`,
          "invalid_style",
          "Shape style is required.",
        );
      break;
    case "text":
      if (
        typeof value.text !== "string" ||
        !isRecord(value.style) ||
        typeof value.altText !== "string"
      )
        add(
          issues,
          path,
          "invalid_text",
          "Text content, style, and alt text are required.",
        );
      break;
    case "sticky":
      if (typeof value.text !== "string" || typeof value.color !== "string")
        add(
          issues,
          path,
          "invalid_sticky",
          "Sticky text and color are required.",
        );
      break;
    case "media":
      if (
        typeof value.assetId !== "string" ||
        typeof value.altText !== "string"
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
        typeof value.title !== "string" ||
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
      if (typeof value.title !== "string" || !Array.isArray(value.rows))
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
            typeof row.id !== "string" ||
            typeof row.text !== "string" ||
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
        typeof value.prompt !== "string" ||
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
            typeof option.id !== "string" ||
            typeof option.text !== "string"
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
      break;
    case "frame":
      if (typeof value.title !== "string")
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
        value.childIds.some((id) => typeof id !== "string")
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
  if (typeof input.boardId !== "string" || input.boardId.length === 0)
    add(issues, "boardId", "invalid_id", "Board id is required.");
  if (!Number.isInteger(input.generation) || Number(input.generation) < 0)
    add(
      issues,
      "generation",
      "invalid_generation",
      "Generation must be a non-negative integer.",
    );
  if (typeof input.title !== "string")
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
      typeof background.color !== "string" ||
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
      snap.gridSize <= 0
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
  if (
    !Array.isArray(input.rootOrder) ||
    input.rootOrder.some((id) => typeof id !== "string")
  )
    add(
      issues,
      "rootOrder",
      "invalid_root_order",
      "Root order must be an array of ids.",
    );

  if (isRecord(input.objects)) {
    const objectIds = new Set(Object.keys(input.objects));
    for (const [key, value] of Object.entries(input.objects))
      validateObjectShape(value, key, objectIds, issues);
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
