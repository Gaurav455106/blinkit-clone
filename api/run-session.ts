// Vercel function for /api/run-session. Logic lives in server/handlers/runSession.ts.
import { handleRunSession } from "../server/handlers/runSession.js";
import { nodeHandler } from "../server/runner.js";

export default nodeHandler(handleRunSession);
