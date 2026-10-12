import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { engineOverride } from "./lib/engineFlag";
import "./index.css";

// Honour ?engine=v1|v2|auto on any page, before anything renders
engineOverride();

// Pages load in separate files. After a redeploy an open tab may ask for a file
// that no longer exists; reload once to pick up the new build instead of
// showing a blank page.
const RELOADED_AT_KEY = "sim_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 30_000;
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // just reloaded: let the error show
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
