// Vercel function for /api/attempts. Logic lives in server/handlers/attempts.ts.
import { handleAttempts } from "../server/handlers/attempts.js";
import { nodeHandler } from "../server/runner.js";

export default nodeHandler(handleAttempts);
