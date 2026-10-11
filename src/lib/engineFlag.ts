// ── Which engine a run uses ───────────────────────────────────────────────────
// v1 stays the default so batches already running keep the scoring they started
// with. Turn v2 on for a whole deployment with VITE_ENGINE_V2=true, or for one
// browser by opening any page with ?engine=v2 (?engine=v1 switches back).

const STORAGE_KEY = "sim_engine";

export type EngineVersion = "v1" | "v2";

function fromUrl(): EngineVersion | null {
  if (typeof window === "undefined") return null;
  const param = new URLSearchParams(window.location.search).get("engine");
  return param === "v2" || param === "v1" ? param : null;
}

export function engineVersion(): EngineVersion {
  const url = fromUrl();
  try {
    if (url) window.localStorage.setItem(STORAGE_KEY, url);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "v2" || stored === "v1") return stored;
  } catch {
    // Storage blocked (private mode): fall through to the build setting
  }
  if (url) return url;
  return import.meta.env.VITE_ENGINE_V2 === "true" ? "v2" : "v1";
}

export const isEngineV2 = (): boolean => engineVersion() === "v2";
