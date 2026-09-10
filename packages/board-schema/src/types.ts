export const CURRENT_SCHEMA_VERSION = 1 as const;

export type ID = string;
export type ISODateTime = string;
export type ObjectType =
  | "stroke"
  | "shape"
  | "text"
  | "sticky"
  | "media"
  | "action"
  | "checklist"
  | "quiz"
  | "connector"
  | "frame"
  | "group";

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ObjectBase<TType extends ObjectType> {
  id: ID;
  type: TType;
  parentId: ID | null;
  orderKey: string;
  transform: Transform;
  size: Size;
  locked: boolean;
  hidden: boolean;
  createdAt: ISODateTime;
  createdBy: ID;
  updatedAt: ISODateTime;
  updatedBy: ID;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
}

export interface StrokeObject extends ObjectBase<"stroke"> {
  points: StrokePoint[];
  style: StrokeStyle;
}

export type ShapeKind =
  | "line"
  | "rectangle"
  | "rounded-rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "star";

export interface ShapeStyle {
  stroke: string;
  strokeWidth: number;
  fill: string | null;
  opacity: number;
}

export interface ShapeObject extends ObjectBase<"shape"> {
  shape: ShapeKind;
  style: ShapeStyle;
}

export interface TextStyle {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  textAlign: "left" | "center" | "right";
}

export interface TextObject extends ObjectBase<"text"> {
  text: string;
  style: TextStyle;
  altText: string;
}

export interface StickyObject extends ObjectBase<"sticky"> {
  text: string;
  color: string;
}

export interface MediaObject extends ObjectBase<"media"> {
  assetId: ID;
  altText: string;
}

export type ActionStatus = "open" | "in-progress" | "done" | "blocked";

export interface ActionObject extends ObjectBase<"action"> {
  title: string;
  status: ActionStatus;
  assigneeId?: ID;
  dueAt?: ISODateTime;
}

export interface ChecklistRow {
  id: ID;
  text: string;
  done: boolean;
}

export interface ChecklistObject extends ObjectBase<"checklist"> {
  title: string;
  rows: ChecklistRow[];
}

export interface QuizOption {
  id: ID;
  text: string;
}

export interface QuizObject extends ObjectBase<"quiz"> {
  prompt: string;
  options: QuizOption[];
  answerPolicy: "hidden" | "revealed";
  correctOptionId?: ID;
}

export type ConnectorAnchor = "top" | "right" | "bottom" | "left" | "center";
export type ConnectorEndpoint =
  | { kind: "point"; x: number; y: number }
  | { kind: "binding"; objectId: ID; anchor: ConnectorAnchor };

export interface ConnectorObject extends ObjectBase<"connector"> {
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  routing: "straight" | "orthogonal" | "curved";
  style: {
    color: string;
    width: number;
    endMarker: "none" | "arrow";
  };
}

export interface FrameObject extends ObjectBase<"frame"> {
  title: string;
  presentationOrder?: number;
}

export interface GroupObject extends ObjectBase<"group"> {
  childIds: ID[];
}

export type BoardObject =
  | StrokeObject
  | ShapeObject
  | TextObject
  | StickyObject
  | MediaObject
  | ActionObject
  | ChecklistObject
  | QuizObject
  | ConnectorObject
  | FrameObject
  | GroupObject;

export interface BoardSettings {
  background: {
    kind: "solid" | "grid" | "dots";
    color: string;
  };
  snap: {
    enabled: boolean;
    gridSize: number;
  };
}

export interface BoardDocument {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  boardId: ID;
  generation: number;
  title: string;
  settings: BoardSettings;
  objects: Record<ID, BoardObject>;
  rootOrder: ID[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult<T> =
  { ok: true; value: T; issues: [] } | { ok: false; issues: ValidationIssue[] };

export const DEFAULT_ACTOR_ID = "system";
export const EPOCH_TIMESTAMP = "1970-01-01T00:00:00.000Z";
