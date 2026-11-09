// Vercel function for /api/session. Logic lives in server/handlers/session.ts.
import { handleSession } from "../server/handlers/session.js";
import { nodeHandler } from "../server/runner.js";

export default nodeHandler(handleSession);
