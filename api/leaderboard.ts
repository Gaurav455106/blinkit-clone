// Vercel function for /api/leaderboard. Logic lives in server/handlers/leaderboard.ts.
import { handleLeaderboard } from "../server/handlers/leaderboard.js";
import { nodeHandler } from "../server/runner.js";

export default nodeHandler(handleLeaderboard);
