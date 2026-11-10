// ── Runs a handler: settings, session, CSRF check, errors ────────────────────
// Used by the Vercel functions in /api and by the dev server in vite.config.ts.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { HandlerContext } from "./context.js";
import { ConfigError, readConfig, type ServerConfig } from "./env.js";
import { fail, passesCsrfCheck, type ApiRequest, type ApiResult } from "./http.js";
import { SESSION_COOKIE, readCookie, verifySession } from "./session.js";
import { supabaseStore, StoreError, type Store } from "./store.js";

export type Handler = (req: ApiRequest, ctx: HandlerContext) => Promise<ApiResult>;

let cachedStore: { key: string; store: Store } | null = null;

function storeFor(config: ServerConfig): Store {
  const key = `${config.supabaseUrl}|${config.supabaseServiceKey}`;
  if (cachedStore?.key !== key) cachedStore = { key, store: supabaseStore(config.supabaseUrl, config.supabaseServiceKey) };
  return cachedStore.store;
}

function clientIdOf(req: ApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  return forwarded || req.headers["x-real-ip"] || "unknown";
}

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
  store?: Store;
  now?: () => Date;
}

/** Builds the context and runs the handler; never throws. */
export async function runHandler(handler: Handler, req: ApiRequest, options: RunOptions = {}): Promise<ApiResult> {
  let config: ServerConfig;
  try {
    config = readConfig(options.env);
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error("[api] server is not configured:", err.message);
    return fail(500, "not_configured", "The server isn't set up yet. Please tell your trainer.");
  }

  if (!passesCsrfCheck(req)) return fail(403, "csrf", "Request blocked.");

  try {
    const session = await verifySession(readCookie(req.headers.cookie, SESSION_COOKIE), config.sessionSecret);
    const ctx: HandlerContext = {
      session,
      config,
      store: options.store ?? storeFor(config),
      now: options.now ?? (() => new Date()),
      clientId: clientIdOf(req),
    };
    return await handler(req, ctx);
  } catch (err) {
    if (err instanceof StoreError) console.error("[api] database error", err.operation, err.code, err.message);
    else console.error("[api] unexpected error", err);
    return fail(500, "server_error", "Something went wrong on the server. Please try again.");
  }
}

// ── Node adapters ─────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 4 * 1024 * 1024;

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function flatHeaders(headers: IncomingMessage["headers"]): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v]));
}

function flatQuery(url: URL): Record<string, string | undefined> {
  return Object.fromEntries(url.searchParams.entries());
}

/** Vercel already parses JSON bodies onto req.body; plain Node (dev) doesn't. */
type NodeRequest = IncomingMessage & { body?: unknown };

export async function toApiRequest(req: NodeRequest): Promise<ApiRequest> {
  const url = new URL(req.url ?? "/", "http://localhost");
  let body: unknown = req.body;
  if (typeof body === "string") body = parseJson(body);
  else if (body === undefined && req.method !== "GET" && req.method !== "HEAD") body = parseJson(await readRawBody(req));
  return { method: (req.method ?? "GET").toUpperCase(), query: flatQuery(url), body, headers: flatHeaders(req.headers) };
}

export function sendResult(res: ServerResponse, result: ApiResult): void {
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (result.setCookie) res.setHeader("Set-Cookie", result.setCookie);
  res.end(JSON.stringify(result.body));
}

/** Wraps a handler as a Node (req, res) function, for Vercel and the dev server. */
export function nodeHandler(handler: Handler) {
  return async (req: NodeRequest, res: ServerResponse): Promise<void> => {
    let apiReq: ApiRequest;
    try {
      apiReq = await toApiRequest(req);
    } catch (err) {
      console.warn("[api] could not read request", err);
      sendResult(res, fail(400, "bad_request", "Couldn't read the request."));
      return;
    }
    sendResult(res, await runHandler(handler, apiReq));
  };
}
