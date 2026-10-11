// Share of points per part (category) across a student's attempts, oldest first.
// One axis (% of the part's max) so parts with different maxes compare fairly.

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { attemptTotals, type AttemptRow } from "@/lib/attemptAnalysis";
import { SCORE_SCHEMES, type ScoreVersion } from "@/lib/rubrics";

// Categorical slots 1 to 4 of the dataviz reference palette (validated, adjacent pairs).
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;

interface CategoryTrendChartProps {
  rows: readonly AttemptRow[]; // oldest first, one score version
  version: ScoreVersion;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function CategoryTrendChart({ rows, version }: CategoryTrendChartProps) {
  const cats = SCORE_SCHEMES[version];
  const data = rows.map((r, i) => {
    const t = attemptTotals(r);
    const point: Record<string, number | string | null> = { name: `Run ${i + 1}`, date: shortDate(r.created_at) };
    for (const c of cats) point[c.key] = t ? Math.round(((t[c.key] ?? 0) / c.max) * 100) : null;
    return point;
  });

  return (
    <figure>
      <div className="h-64 w-full" role="img" aria-label={`Share of points in each part across ${rows.length} runs`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
              contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              labelFormatter={(label, payload) => `${label}, ${payload?.[0]?.payload?.date ?? ""}`}
              formatter={(value: number, name: string) => [`${value}% of points`, cats.find((c) => c.key === name)?.label ?? name]}
            />
            <Legend formatter={(key: string) => <span className="text-xs text-foreground">{cats.find((c) => c.key === key)?.label ?? key}</span>} iconType="plainline" />
            {cats.map((c, i) => (
              <Line
                key={c.key}
                type="linear"
                dataKey={c.key}
                stroke={SERIES_COLORS[i]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: SERIES_COLORS[i] }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">Each line shows the share of points you got in one part. Exact numbers are in the table of attempts below.</figcaption>
    </figure>
  );
}
