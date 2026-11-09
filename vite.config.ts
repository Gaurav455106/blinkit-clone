import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const API_ROUTES = ["session", "attempts", "run-session", "leaderboard", "staff", "admin"];

/**
 * Serves /api/* in `npm run dev` with the same files Vercel runs, so local
 * development matches production. Server settings come from `.env`.
 */
function apiDevServer(mode: string): Plugin {
  return {
    name: "blinkit-api-dev",
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), "");
      for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
      process.env.INSECURE_DEV_COOKIES ??= "1";

      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.match(/^\/api\/([a-z-]+)(?:\?|$)/)?.[1];
        if (!route || !API_ROUTES.includes(route)) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${route}.ts`);
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[api] /api/${route} failed: ${String(err)}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, data: null, error: "Dev API error", code: "server_error" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), apiDevServer(mode), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  test: {
    environment: "node",
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
