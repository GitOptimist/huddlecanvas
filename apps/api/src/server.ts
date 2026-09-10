import Fastify from "fastify";

import { capabilitiesFor, type Role } from "@huddlecanvas/authz";

export function buildServer() {
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({
    status: "ok",
    service: "huddlecanvas-api",
    persistence: "not-configured",
  }));

  server.get("/v1/meta", async () => ({
    milestone: "M3.1-foundation",
    schemaVersion: 1,
    capabilities: {
      owner: capabilitiesFor("owner"),
      editor: capabilitiesFor("editor"),
      commenter: capabilitiesFor("commenter"),
      viewer: capabilitiesFor("viewer"),
      "guest-session": capabilitiesFor("guest-session"),
    } satisfies Record<Role, string[]>,
    boundaries: {
      authentication: false,
      durableStorage: false,
      realtime: false,
    },
  }));

  return server;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3001);
  const server = buildServer();
  await server.listen({ host: "0.0.0.0", port });
}
