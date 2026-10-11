// ── Guided tours: one per section (like a first visit to Google Ads) ─────────
// Pure data. Each step points at an element marked data-tour="<target>" (or a
// CSS selector starting with # or [). Steps whose element isn't on the page are
// skipped, so one tour can cover a page whose parts come and go.
// Copy rules: plain words a 15-year-old can follow, short, no em dashes.

export type TourSide = "top" | "right" | "bottom" | "left";

export interface TourStep {
  target: string;
  title: string;
  body: string;
  side?: TourSide;
}

export interface TourDef {
  /** Shown on the replay button's tooltip and the first popover. */
  name: string;
  steps: readonly TourStep[];
}

export type TourId =
  | "dashboard" | "brief" | "cmPitch" | "wizard" | "setupScore"
  | "liveV1Setup" | "liveV1Run" | "liveV2Setup" | "liveV2Run"
  | "resultsV1" | "resultsV2";

export const TOURS: Readonly<Record<TourId, TourDef>> = {
  dashboard: {
    name: "Your dashboard",
    steps: [
      { target: "dash-next-step", title: "Start here", body: "This card always shows your next step. Right now it takes you to your client's brief.", side: "bottom" },
      { target: "dash-steps", title: "The four stages", body: "Every attempt goes the same way: read the brief, pitch the category manager, build campaigns, then run 30 days.", side: "bottom" },
      { target: "dash-stats", title: "Your scores", body: "Your attempts, best score and average score. Scores are out of 100.", side: "top" },
      { target: "dash-history", title: "Past attempts", body: "Every finished run lands here, so you can see what changed between tries.", side: "top" },
      { target: "sidebar-nav", title: "Moving around", body: "Use the sidebar to jump between stages. Stages unlock in order.", side: "right" },
      { target: "tour-button", title: "Need this again?", body: "Click Show me around on any page to replay its tour.", side: "bottom" },
    ],
  },
  brief: {
    name: "The client brief",
    steps: [
      { target: "brief-summary", title: "The short version", body: "Who the client is, what they want and where they have stock. Read this first.", side: "bottom" },
      { target: "brief-tabs", title: "The details", body: "Each tab covers one topic: money per sale, rivals, keywords, key dates and the people involved. The numbers here decide what works later.", side: "bottom" },
      { target: "brief-budget", title: "Split your budget", body: "Choose how much of the money goes to getting noticed and how much to getting sales. The brief's goal tells you which matters more.", side: "top" },
      { target: "brief-quiz", title: "Two quick checks", body: "Answer both questions to show you read the brief. You can't continue until you do.", side: "top" },
      { target: "brief-notes", title: "Pin what matters", body: "Pinned notes stay with you through setup and the live run, so you don't have to come back here.", side: "left" },
      { target: "brief-continue", title: "Next: Rohit", body: "When you're ready, meet Rohit, the category manager who decides shelf space and stock.", side: "top" },
    ],
  },
  cmPitch: {
    name: "Pitching Rohit",
    steps: [
      { target: "#cm-relationship-section", title: "Your relationship with Rohit", body: "Rohit decides your shelf space and how many stores stock you. This meter shows how much he trusts you. A strong pitch gets more stores stocked, more ad delivery and top shelf spots.", side: "right" },
      { target: "pitch-rohit", title: "What Rohit can see", body: "Rohit checks every claim against his own numbers. The chips show what he's looking at.", side: "bottom" },
      { target: "pitch-tokens", title: "Tokens", body: "A weak pitch costs a token, and so does pitching again. You can't earn more, so get it right.", side: "bottom" },
      { target: "pitch-skus", title: "Pick products and states", body: "For each product, say whether to include it, where to sell it and why. Pick reasons the brief backs up.", side: "top" },
      { target: "pitch-send", title: "Send your pitch", body: "Rohit replies with questions. Your answers decide your pitch score, out of 15.", side: "top" },
    ],
  },
  wizard: {
    name: "Building a campaign",
    steps: [
      { target: "wizard-stepper", title: "Five steps", body: "Every campaign goes through the same five steps. This shows where you are.", side: "bottom" },
      { target: "wizard-name", title: "Name it", body: "Give each campaign a clear name, like the product and goal. You'll see it in every report.", side: "bottom" },
      { target: "wizard-objective", title: "Pick the goal", body: "Performance is for sales. Reach is for getting noticed. The ad formats you can pick depend on this.", side: "top" },
      { target: "wizard-sidebar", title: "Your catalogue", body: "Check your products and brand collections here at any time.", side: "right" },
      { target: "wizard-next", title: "Move on", body: "Next checks the step is complete. You can go back without losing anything.", side: "top" },
    ],
  },
  setupScore: {
    name: "Your setup score",
    steps: [
      { target: "setup-total", title: "Setup score", body: "How well your campaigns fit the brief before a single day runs.", side: "bottom" },
      { target: "setup-lines", title: "Line by line", body: "Each line says what was checked and why you got those points. Fix anything weak before launch.", side: "top" },
      { target: "setup-later", title: "Still to play for", body: "Most points come later, from how you react during the run and your final results.", side: "left" },
      { target: "setup-launch", title: "Launch", body: "When you're happy, launch the 30-day run. You can still change things while it runs.", side: "top" },
    ],
  },
  liveV1Setup: {
    name: "Your ad dashboard",
    steps: [
      { target: "v1-header", title: "Ad Summary", body: "Your Blinkit ads dashboard. The wallet shows how much of the ₹2 lakh is left to plan.", side: "bottom" },
      { target: "v1-campaigns", title: "Your campaigns", body: "Every campaign you build appears here. Create new campaign opens the Blinkit wizard.", side: "top" },
      { target: "v1-right", title: "Decisions and stock", body: "Stock by state, live insights and decisions show up here once the run starts.", side: "left" },
      { target: "v1-launch", title: "Launch", body: "When your campaigns are ready, launch the 30-day run.", side: "bottom" },
    ],
  },
  liveV1Run: {
    name: "The live run",
    steps: [
      { target: "v1-clock", title: "The clock", body: "Days pass on their own. Pause, change speed or jump ahead here.", side: "bottom" },
      { target: "v1-overview", title: "How it's going", body: "Spend, views, add-to-carts and units so far. Tick a box to show it on the chart.", side: "bottom" },
      { target: "v1-chart", title: "Day by day", body: "Watch for days where spend jumps but sales don't.", side: "top" },
      { target: "v1-campaigns", title: "Change campaigns", body: "Pause, scale or change hours from each campaign row. Changes start from the next day.", side: "top" },
      { target: "v1-right", title: "Decisions", body: "Surprises and stock warnings appear here. Respond in time, or the worst option is picked for you.", side: "left" },
    ],
  },
  liveV2Setup: {
    name: "Before you go live",
    steps: [
      { target: "v2-campaign-list", title: "Your campaigns", body: "These start on day 1. Drafts don't run until you finish them.", side: "right" },
      { target: "v2-new-campaign", title: "New campaign", body: "Opens the Blinkit wizard. You can add more campaigns at any time, even mid-run.", side: "bottom" },
      { target: "v2-calendar", title: "Dates to plan for", body: "Paydays, sale days and festivals change how many people search. Surprises are not listed.", side: "left" },
      { target: "v2-go-live", title: "Go live", body: "Starts the 30 days. Each day runs in a few seconds, and you can pause at any time.", side: "bottom" },
    ],
  },
  liveV2Run: {
    name: "The live run",
    steps: [
      { target: "v2-clock", title: "The clock", body: "Play, pause or run one day at a time. The clock stops by itself when something needs you.", side: "bottom" },
      { target: "v2-stats", title: "The scoreboard", body: "Spend, sales, ROAS and profit so far. ROAS above break-even means the ads make money.", side: "bottom" },
      { target: "v2-tabs", title: "Where to make changes", body: "Keywords for bids, Campaigns for budgets, hours and states. Competition shows who takes your slots. Reports has the Excel files.", side: "bottom" },
      { target: "v2-news", title: "Market news", body: "Rivals, sales and stock problems show up here. Each one says how many days you have to react.", side: "top" },
      { target: "v2-calendar", title: "Coming up", body: "Planned dates, so you can get ready before they hit.", side: "left" },
      { target: "v2-promises", title: "Promises to Rohit", body: "What you promised Rohit and whether you kept it. Broken promises cost you his trust.", side: "left" },
      { target: "v2-new-campaign", title: "Add a campaign", body: "Launch a new campaign mid-run. It starts the next day.", side: "bottom" },
    ],
  },
  resultsV1: {
    name: "Your results",
    steps: [
      { target: "results-header", title: "Your score", body: "Your total out of 100 and your grade.", side: "bottom" },
      { target: "results-summary", title: "Why you got it", body: "A short note per part of the score: what went well and what to do first next time.", side: "top" },
      { target: "results-goals", title: "Client goals", body: "Each goal from the brief and how close you got.", side: "top" },
      { target: "results-breakdown", title: "Every point", body: "Open any line to see what was checked, every level of points, and what would have earned more.", side: "top" },
      { target: "results-download", title: "Take it with you", body: "Download everything as an Excel file.", side: "bottom" },
    ],
  },
  resultsV2: {
    name: "Your results",
    steps: [
      { target: "results-header", title: "Your score", body: "Your total out of 100 and your grade.", side: "bottom" },
      { target: "results-mistakes", title: "Costliest mistakes", body: "The moments where a different move would have earned the most, in rupees. We worked it out by replaying those days.", side: "top" },
      { target: "results-summary", title: "Why you got it", body: "A short note per part of the score: what went well and what to do first next time.", side: "top" },
      { target: "results-moments", title: "Decision moments", body: "Each time the data called for action: what you did, and the best move.", side: "top" },
      { target: "results-breakdown", title: "Every point", body: "Open any line to see what was checked and what would have earned more.", side: "top" },
      { target: "results-download", title: "Take it with you", body: "Download your score, moments and all 12 reports as one Excel file.", side: "bottom" },
    ],
  },
};
