// Vercel function for /api/admin. Logic lives in server/handlers/admin.ts.
import { handleAdmin } from "../server/handlers/admin.js";
import { nodeHandler } from "../server/runner.js";

export default nodeHandler(handleAdmin);
