// ── The website's only way to reach the database: our own /api routes ────────
// The server checks the signed session cookie on every call, so what a
// student can read or change no longer depends on anything in the browser.

export const SESSION_EXPIRED_EVENT = "sim:session-expired";
/** A sign-in just worked: anything warning that the sign-in ended can clear. */
export const SESSION_STARTED_EVENT = "sim:session-started";

/** Sent on every request that changes data; see server/http.ts. */
const CSRF_HEADERS = { "X-Requested-With": "blinkit-sim" } as const;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error: string | null;
  code?: string;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Query = Record<string, string | number | undefined>;

function urlFor(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function announce(event: string): void {
  try {
    window.dispatchEvent(new Event(event));
  } catch {
    // No window: nothing to announce to
  }
}

// ── Holding requests while a hub sign-in runs ────────────────────────────────
// A launch can land on a browser that still holds an older, expired sign-in.
// The app restores the last run from this browser straight away and tries to
// save it; sent now, that goes out with the old cookie, fails, and puts up "your
// sign-in has ended" over a sign-in that is about to work. Such calls are
// skipped, not queued: on a shared computer a queued save could belong to the
// previous student. Once the sign-in is done the app saves again as usual.

/** True from page load on /sso?token=… (the restore can run before the sign-in starts). */
function arrivedWithLaunchToken(): boolean {
  try {
    return window.location.pathname === "/sso" && new URLSearchParams(window.location.search).has("token");
  } catch {
    return false;
  }
}

let signingIn = arrivedWithLaunchToken();

/** Runs a sign-in; other API calls are skipped until it finishes, whether it works or not. */
export async function whileSigningIn<T>(signIn: () => Promise<T>): Promise<T> {
  signingIn = true;
  try {
    const session = await signIn();
    announce(SESSION_STARTED_EVENT);
    return session;
  } finally {
    signingIn = false;
  }
}

async function readEnvelope<T>(response: Response): Promise<Envelope<T> | null> {
  try {
    return (await response.json()) as Envelope<T>;
  } catch {
    return null;
  }
}

/** Calls an /api route and returns its data; throws ApiError on any failure. */
export async function api<T>(
  method: Method,
  path: string,
  options: { query?: Query; body?: unknown; isSignIn?: boolean } = {},
): Promise<T> {
  if (signingIn && !options.isSignIn) throw new ApiError(0, "signing_in", "Waiting for the sign-in to finish.");
  let response: Response;
  try {
    response = await fetch(urlFor(path, options.query), {
      method,
      credentials: "same-origin",
      headers: {
        ...(method === "GET" ? {} : CSRF_HEADERS),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (err) {
    throw new ApiError(0, "network", err instanceof Error ? err.message : "Network error");
  }

  const envelope = await readEnvelope<T>(response);
  if (response.ok && envelope?.success) return envelope.data;

  const code = envelope?.code ?? "http_error";
  if (response.status === 401 && code === "unauthenticated") announce(SESSION_EXPIRED_EVENT);
  throw new ApiError(response.status, code, envelope?.error ?? `Request failed (${response.status})`);
}

/** Matches MAX_PAGE_SIZE in server/validate.ts. */
export const PAGE_SIZE = 100;

/**
 * Reads a paged list until it runs out or `maxRows` is reached. Lists are paged
 * because the server can return at most about 4.5 MB per response.
 */
export async function fetchAllPages<T>(path: string, query: Query, maxRows: number): Promise<T[]> {
  let rows: T[] = [];
  while (rows.length < maxRows) {
    const limit = Math.min(PAGE_SIZE, maxRows - rows.length);
    const page = await api<T[]>("GET", path, { query: { ...query, limit, offset: rows.length } });
    rows = [...rows, ...page];
    if (page.length < limit) break;
  }
  return rows;
}

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
