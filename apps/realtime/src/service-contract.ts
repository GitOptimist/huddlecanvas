import type { Role } from "@huddlecanvas/authz";

export const REALTIME_PROTOCOL_VERSION = 1 as const;

export interface SessionIdentity {
  userId: string;
  role: Role;
  displayName: string;
}

export interface PresenceState {
  boardId: string;
  sessionId: string;
  identity: SessionIdentity;
  cursor?: { x: number; y: number };
  selectedObjectIds: string[];
  lastSeenAt: string;
}

export type ClientEvent =
  | { type: "presence.update"; payload: PresenceState }
  | {
      type: "board.command";
      boardId: string;
      baseGeneration: number;
      commandId: string;
      payload: unknown;
    }
  | { type: "session.leave"; boardId: string; sessionId: string };

export type ServerEvent =
  | {
      type: "presence.snapshot";
      boardId: string;
      participants: PresenceState[];
    }
  | {
      type: "board.accepted";
      boardId: string;
      commandId: string;
      generation: number;
    }
  | {
      type: "board.rejected";
      boardId: string;
      commandId: string;
      reason: "forbidden" | "stale-generation" | "invalid-command";
    }
  | { type: "service.unavailable"; retryAfterMs: number };

export interface RealtimeFoundationStatus {
  protocolVersion: typeof REALTIME_PROTOCOL_VERSION;
  transportImplemented: false;
  durableFanoutImplemented: false;
  note: string;
}

export function realtimeFoundationStatus(): RealtimeFoundationStatus {
  return {
    protocolVersion: REALTIME_PROTOCOL_VERSION,
    transportImplemented: false,
    durableFanoutImplemented: false,
    note: "Protocol boundary only; transport follows the durability spike.",
  };
}
