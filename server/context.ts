// ── What every handler receives ──────────────────────────────────────────────

import type { ServerConfig } from "./env.js";
import type { Session } from "./session.js";
import type { Store } from "./store.js";

export interface HandlerContext {
  session: Session | null;
  store: Store;
  config: ServerConfig;
  now: () => Date;
  /** Best-effort client identifier (IP) for rate limiting. */
  clientId: string;
}
