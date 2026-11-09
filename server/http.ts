// ── Request and response shapes shared by every API route ────────────────────
// Handlers take a plain ApiRequest and return an ApiResult, so they can be
// tested without a server and run the same way on Vercel and in `npm run dev`.

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequest {
  method: string;
  query: Record<string, string | undefined>;
  body: unknown;
  headers: Record<string, string | undefined>;
}

export interface ApiResult {
  status: number;
  body: ApiEnvelope;
  setCookie?: string;
}

/** Every response uses this envelope. */
export interface ApiEnvelope {
  success: boolean;
  data: unknown;
  error: string | null;
  /** Machine-readable reason, e.g. "unauthenticated", "expired". */
  code?: string;
}

export const ok = (data: unknown, setCookie?: string): ApiResult => ({
  status: 200,
  body: { success: true, data, error: null },
  ...(setCookie ? { setCookie } : {}),
});

export const fail = (status: number, code: string, error: string, setCookie?: string): ApiResult => ({
  status,
  body: { success: false, data: null, error, code },
  ...(setCookie ? { setCookie } : {}),
});

export const unauthenticated = () => fail(401, "unauthenticated", "Please launch the simulation from the Kraftshala Hub again.");
export const forbidden = () => fail(403, "forbidden", "You don't have access to this.");
export const methodNotAllowed = () => fail(405, "method_not_allowed", "Method not allowed.");
export const badRequest = (message: string) => fail(400, "bad_request", message);

/**
 * Header the website sends on every request that changes data. A cross-site
 * page can't add a custom header without a CORS preflight, which this API
 * never approves, so this blocks cross-site request forgery.
 */
export const CSRF_HEADER = "x-requested-with";
export const CSRF_VALUE = "blinkit-sim";

export function passesCsrfCheck(req: ApiRequest): boolean {
  if (req.method === "GET") return true;
  return req.headers[CSRF_HEADER] === CSRF_VALUE;
}
