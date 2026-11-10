// ── Server settings, read from environment variables ─────────────────────────
// None of these reach the browser. Set them in Vercel → Project → Settings →
// Environment Variables, and in a local `.env` for `npm run dev`.

export interface ServerConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  /** Signs the session cookie. At least 32 random characters. */
  sessionSecret: string;
  /** Kraftshala Hub origin: the JWT issuer and the JWKS host. */
  hubUrl: string;
  /** Optional emergency staff key. Master sign-in is off when unset. */
  masterKey: string | null;
  /** False only for local http development, so the cookie works without https. */
  secureCookies: boolean;
}

const DEFAULT_HUB_URL = "https://ksstudentshub.vercel.app";
const MIN_SECRET_LENGTH = 32;
const MIN_MASTER_KEY_LENGTH = 16;

export class ConfigError extends Error {}

function required(env: NodeJS.ProcessEnv, name: string, fallback?: string): string {
  const value = env[name]?.trim() || (fallback ? env[fallback]?.trim() : undefined);
  if (!value) throw new ConfigError(`Missing environment variable ${name}`);
  return value;
}

/** Reads and validates the settings; throws ConfigError naming the first problem. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const sessionSecret = required(env, "SESSION_SECRET");
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  const masterKey = env.MASTER_KEY?.trim() || null;
  if (masterKey && masterKey.length < MIN_MASTER_KEY_LENGTH) {
    throw new ConfigError(`MASTER_KEY must be at least ${MIN_MASTER_KEY_LENGTH} characters`);
  }

  const hubUrl = (env.HUB_URL?.trim() || DEFAULT_HUB_URL).replace(/\/+$/, "");

  return {
    supabaseUrl: required(env, "SUPABASE_URL", "VITE_SUPABASE_URL"),
    supabaseServiceKey: required(env, "SUPABASE_SERVICE_ROLE_KEY"),
    sessionSecret,
    hubUrl,
    masterKey,
    secureCookies: env.INSECURE_DEV_COOKIES !== "1",
  };
}
