// Vercel function for /api/staff. Logic lives in server/handlers/staff.ts.
import { handleStaff } from "../server/handlers/staff.js";
import { nodeHandler } from "../server/runner.js";

export default nodeHandler(handleStaff);
