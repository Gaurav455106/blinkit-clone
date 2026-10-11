// Chart colours: the dataviz reference palette, slots 1–4 validated together
// (validate_palette.js, light mode: all hard checks pass; aqua and yellow are
// under 3:1 contrast, so every chart keeps a legend and a table view).

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;

/** Visibility outcomes, in a fixed order (won, lost to rank, budget, stock). */
export const OUTCOME_COLORS = { won: SERIES[0], rank: SERIES[1], budget: SERIES[3], stock: SERIES[2] } as const;

/** Diverging pair for "makes money" vs "loses money", with a neutral middle. */
export const PROFIT = { gain: "#2a78d6", neutral: "#d9d6cf", loss: "#eb6834" } as const;

export const AXIS = { stroke: "hsl(28 6% 62%)", grid: "hsl(36 12% 90%)", text: "hsl(28 6% 42%)" } as const;
