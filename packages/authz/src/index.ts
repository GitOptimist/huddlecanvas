export const ROLES = [
  "owner",
  "editor",
  "commenter",
  "viewer",
  "guest-session",
] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  "board.read",
  "board.edit",
  "board.comment",
  "board.vote",
  "board.facilitate",
  "board.share",
  "board.delete",
  "version.create",
  "version.restore",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Readonly<Record<Role, ReadonlySet<Capability>>> = {
  owner: new Set(CAPABILITIES),
  editor: new Set([
    "board.read",
    "board.edit",
    "board.comment",
    "board.vote",
    "board.facilitate",
    "version.create",
  ]),
  commenter: new Set(["board.read", "board.comment", "board.vote"]),
  viewer: new Set(["board.read"]),
  "guest-session": new Set(["board.read", "board.vote"]),
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

export class AuthorizationError extends Error {
  readonly role: Role;
  readonly capability: Capability;

  constructor(role: Role, capability: Capability) {
    super(`Role '${role}' cannot perform '${capability}'.`);
    this.name = "AuthorizationError";
    this.role = role;
    this.capability = capability;
  }
}

export function assertCapability(role: Role, capability: Capability): void {
  if (!can(role, capability)) throw new AuthorizationError(role, capability);
}

export function capabilitiesFor(role: Role): Capability[] {
  return CAPABILITIES.filter((capability) => can(role, capability));
}
