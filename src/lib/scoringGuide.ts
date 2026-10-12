// ── How students are judged (new scoring, v2) ─────────────────────────────────
// Plain-language guide for the trainer and admin panels. Marks come from the
// scoring constants, so the guide can't drift from what scoringV2 awards
// (scoringGuide.test.ts checks every part adds up).

import { SCORE_V2_MAX, MOMENT_CAP } from "@/market/scoringV2";
import { LIVE_FACTOR_MAX, SCALE_WINDOW } from "@/market/liveFactors";

export interface GuideLine {
  label: string;
  max: number;
  /** What the student is judged on, one sentence. */
  what: string;
  /** How the marks are given, shortest first. */
  marks: readonly string[];
}

export interface GuidePart {
  key: keyof typeof SCORE_V2_MAX;
  label: string;
  max: number;
  /** The question this part answers. */
  question: string;
  lines: readonly GuideLine[];
}

const LIVE_INSIGHTS = 5;
const LIVE_MOMENTS = SCORE_V2_MAX.live - LIVE_INSIGHTS
  - LIVE_FACTOR_MAX.scaling - LIVE_FACTOR_MAX.improvement - LIVE_FACTOR_MAX.peak - LIVE_FACTOR_MAX.steady;

export const SCORING_GUIDE_V2: readonly GuidePart[] = [
  {
    key: "setup", label: "Setup", max: SCORE_V2_MAX.setup,
    question: "Did they build campaigns that fit the brief?",
    lines: [
      { label: "Objective and format fit", max: 8, what: "Campaigns use the ad formats that suit this brand right now.", marks: ["8: the brand's best format", "6: another good format", "3: right family of format", "0: none of these"] },
      { label: "Keyword choice", max: 5, what: "Share of keywords that can make money (a click is worth more than the slot costs).", marks: ["5 × the share that can be profitable", "Full marks if the brand doesn't need keywords"] },
      { label: "Bid discipline", max: 6, what: "Bids stay at or below the most they can pay and still make money.", marks: ["6 × the share of bids at or below that level"] },
      { label: "Campaign structure", max: 6, what: "Campaigns are split to avoid the brand's traps (hero product, long-tail keywords, best state get their own budget).", marks: ["6 × the share of traps avoided"] },
    ],
  },
  {
    key: "live", label: "Live optimisation", max: SCORE_V2_MAX.live,
    question: "During the 30 days, did they read the data and make the right changes?",
    lines: [
      {
        label: "Decision moments", max: LIVE_MOMENTS,
        what: "The game spots moments an expert would act (a keyword losing money, lost visibility, budget gone before peak hours, a strong state starved) and replays each one three ways: their change, no change, and the best fix.",
        marks: [
          `Split across the moments, at most ${MOMENT_CAP} per moment`,
          "Full: their change got at least 60% of the best fix's gain",
          "Half: some gain, or acted late. 0: ignored, or made it worse",
          "Marks no moment used are earned by how little spend was wasted",
        ],
      },
      { label: "Analysis to action", max: LIVE_INSIGHTS, what: "Insights written at the weekly checkpoints name real problems in the reports, and they act on them.", marks: ["5: real problem and acted within 3 days", "3: real problem, no action", "0: none, or not backed by the data"] },
      { label: "Scaling winners", max: LIVE_FACTOR_MAX.scaling, what: `Keywords or placements earning well but missing searches: within ${SCALE_WINDOW} days, did they add budget (if the budget ran out) or raise the bid (if it lost on rank)?`, marks: ["5 × the share of winners scaled with the right lever", "Full marks if nothing was worth scaling"] },
      { label: "Getting better", max: LIVE_FACTOR_MAX.improvement, what: "Wasted spend (where ads lost money on the brand's goal) in week 1 compared with days 15 to 30.", marks: ["4: waste at least halved, or 10% or less late in the run", "Partial credit for smaller cuts. 0: waste stayed or grew"] },
      { label: "Peak hours covered", max: LIVE_FACTOR_MAX.peak, what: "Campaigns whose budget ran out still covered the busiest hour (via the ad schedule or more budget).", marks: ["3: 80% or more of the peak hour covered, or no budget ran out", "Less coverage, fewer marks"] },
      { label: "Steady hands", max: LIVE_FACTOR_MAX.steady, what: "They gave changes time to work instead of flip-flopping.", marks: ["Starts at 3", "-1 for each setting changed more than twice in 3 days"] },
    ],
  },
  {
    key: "eventsRohit", label: "Market events and Rohit", max: SCORE_V2_MAX.eventsRohit,
    question: "Did they handle the market and the category manager well?",
    lines: [
      { label: "Budget pacing", max: 5, what: "The money lasted the whole 30 days.", marks: ["5: ads ran to the end", "2.5: ran out in the last 5 days", "0: ran out earlier"] },
      { label: "Deal with Rohit", max: 5, what: "Stock placed where people search, and fair value for what they offered Rohit. (Older runs: the pitch to Rohit.)", marks: ["2.5 for stock that follows searches", "2.5 for a fair trade"] },
      { label: "Response to alerts", max: 5, what: "Each alert that paused the clock (rival attack, stock running low, budget capping) had right moves; did they make one in time?", marks: ["5: a right move for every alert", "2: changed something, not a right move", "0: no change in time"] },
      { label: "Rohit check-ins", max: 5, what: "Replies to Rohit during the run backed by data, and promises kept.", marks: ["5: data-backed replies and promises kept", "3: mixed", "1: weak replies and broken promises"] },
    ],
  },
  {
    key: "results", label: "Results", max: SCORE_V2_MAX.results,
    question: "What did the 30 days achieve?",
    lines: [
      { label: "Client goals", max: 10, what: "Average achievement across the client's goals; each goal counts up to 100%.", marks: ["10: 90% or more", "7: 70%+", "4: 50%+", "1: under 50%"] },
      { label: "ROAS vs break-even", max: 5, what: "Whether the ads made money overall.", marks: ["5: 1.1× break-even or better", "3: at break-even", "1: 0.8×", "0: below"] },
      { label: "Wasted spend", max: 5, what: "Share of money spent where ads lost money over the run.", marks: ["5: 10% or less", "3: 25% or less", "1: 40% or less", "0: more"] },
    ],
  },
];
