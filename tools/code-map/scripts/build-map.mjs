// Turns graphify-out/graph.json into public/map.json for the 3D code map.
// Each graphify community becomes a district; districts are grouped into areas
// by the folder most of their nodes live in, and laid out as sectors of a city.
// Run: npm run map (dev and build run it first).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const GRAPH = resolve(here, "../../../graphify-out/graph.json");
const OUT = resolve(here, "../public/map.json");

const MIN_DISTRICT_NODES = 3;
const TOP_NODES_PER_DISTRICT = 8;
const LANDMARKS = 12;
const MAX_ROADS = 160;
const INNER_RADIUS = 16;
const GAP = 2.5;

const AREAS = [
  { id: "market", label: "Market engine", color: "#2f855a", test: (f) => f.startsWith("src/market/") },
  { id: "pages", label: "Pages", color: "#2b6cb0", test: (f) => f.startsWith("src/pages/") },
  { id: "ui", label: "UI kit", color: "#718096", test: (f) => f.startsWith("src/components/ui/") },
  { id: "components", label: "Components", color: "#3182ce", test: (f) => f.startsWith("src/components/") },
  { id: "logic", label: "Logic and scoring", color: "#d69e2e", test: (f) => f.startsWith("src/lib/") },
  { id: "state", label: "State and data", color: "#dd6b20", test: (f) => /^src\/(context|hooks|data|integrations)\//.test(f) },
  { id: "docs", label: "Docs", color: "#805ad5", test: (f) => /\.md$/i.test(f) },
  { id: "config", label: "Config", color: "#a0aec0", test: () => true },
];

const isTest = (f) => f.includes("__tests__") || /\.(test|calibration)\.[tj]sx?$/.test(f);
const areaOf = (file) => (isTest(file) ? "tests" : AREAS.find((a) => a.test(file)).id);
const ALL_AREAS = [...AREAS.slice(0, -1), { id: "tests", label: "Tests", color: "#e53e3e" }, AREAS.at(-1)];

if (!existsSync(GRAPH)) {
  console.error(`No graph at ${GRAPH}. Run "graphify update ." in the repo root first.`);
  process.exit(1);
}

const graph = JSON.parse(readFileSync(GRAPH, "utf8"));
const nodes = graph.nodes ?? [];
const links = graph.links ?? graph.edges ?? [];

const degree = new Map();
for (const e of links) {
  degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
  degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
}
const nodeById = new Map(nodes.map((n) => [n.id, n]));

// ── Districts ────────────────────────────────────────────────────────────────
const byCommunity = new Map();
for (const n of nodes) {
  const c = n.community ?? -1;
  if (!byCommunity.has(c)) byCommunity.set(c, []);
  byCommunity.get(c).push(n);
}

const mostCommon = (xs) => {
  const counts = new Map();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const districts = [...byCommunity.entries()]
  .filter(([, members]) => members.length >= MIN_DISTRICT_NODES)
  .map(([community, members]) => {
    const files = members.map((m) => m.source_file).filter(Boolean);
    const top = [...members]
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
      .slice(0, TOP_NODES_PER_DISTRICT)
      .map((m) => ({ id: m.id, label: m.label, file: m.source_file ?? "", degree: degree.get(m.id) ?? 0 }));
    const fileList = [...new Set(files)];
    return {
      id: `d${community}`,
      community,
      name: members[0].community_name ?? `Group ${community}`,
      area: areaOf(mostCommon(files) ?? ""),
      nodes: members.length,
      files: fileList.slice(0, 12),
      fileCount: fileList.length,
      top,
      radius: Math.round((2 + Math.sqrt(members.length) * 0.55) * 10) / 10,
    };
  });

const districtOf = new Map();
for (const d of districts) for (const n of byCommunity.get(d.community)) districtOf.set(n.id, d.id);

// ── Layout: one sector per area, districts packed outward on rings ───────────
const usedAreas = ALL_AREAS.filter((a) => districts.some((d) => d.area === a.id));
const rawWeight = (a) => districts.filter((d) => d.area === a.id).reduce((s, d) => s + d.radius ** 2, 0);
const rawTotal = usedAreas.reduce((s, a) => s + rawWeight(a), 0);
/** Every area gets at least this share of the circle, so small ones don't stretch outwards. */
const MIN_AREA_SHARE = 0.07;
const weightOf = (a) => Math.max(rawWeight(a), rawTotal * MIN_AREA_SHARE);
const totalWeight = usedAreas.reduce((s, a) => s + weightOf(a), 0);
let angle = 0;
const placed = [];
for (const area of usedAreas) {
  const span = (weightOf(area) / totalWeight) * Math.PI * 2;
  const [a0, a1] = [angle + 0.04, angle + span - 0.04];
  area.angle = angle + span / 2;
  angle += span;
  const members = districts.filter((d) => d.area === area.id).sort((x, y) => y.nodes - x.nodes);
  let ring = INNER_RADIUS;
  for (const d of members) {
    let done = false;
    while (!done) {
      for (let t = a0 + d.radius / ring; t <= a1 - d.radius / ring + 1e-9 && !done; t += (d.radius * 0.8) / ring) {
        const x = Math.cos(t) * ring;
        const z = Math.sin(t) * ring;
        if (placed.every((p) => Math.hypot(p.x - x, p.z - z) >= p.radius + d.radius + GAP)) {
          Object.assign(d, { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
          placed.push(d);
          done = true;
        }
      }
      if (!done) ring += 1;
    }
  }
}

// ── Roads: links between districts, strongest first ──────────────────────────
const roadWeight = new Map();
for (const e of links) {
  const a = districtOf.get(e.source);
  const b = districtOf.get(e.target);
  if (!a || !b || a === b) continue;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  roadWeight.set(key, (roadWeight.get(key) ?? 0) + 1);
}
const roads = [...roadWeight.entries()]
  .sort((x, y) => y[1] - x[1])
  .slice(0, MAX_ROADS)
  .map(([key, weight]) => {
    const [a, b] = key.split("|");
    return { a, b, weight };
  });
const linksOf = new Map();
for (const [key, w] of roadWeight) for (const id of key.split("|")) linksOf.set(id, (linksOf.get(id) ?? 0) + w);
for (const d of districts) d.links = linksOf.get(d.id) ?? 0;

// ── Landmarks: the most connected nodes ("god nodes") ────────────────────────
const landmarks = [...degree.entries()]
  .filter(([id]) => districtOf.has(id))
  .sort((a, b) => b[1] - a[1])
  .slice(0, LANDMARKS)
  .map(([id, deg]) => {
    const n = nodeById.get(id);
    return { id, label: n.label, file: n.source_file ?? "", degree: deg, district: districtOf.get(id) };
  });

const map = {
  builtAt: new Date().toISOString(),
  commit: graph.built_at_commit ?? null,
  totals: { nodes: nodes.length, links: links.length, districts: districts.length },
  areas: usedAreas.map(({ id, label, color, angle: a }) => ({ id, label, color, angle: a })),
  districts: districts.map(({ community: _c, ...d }) => d),
  roads,
  landmarks,
};
writeFileSync(OUT, JSON.stringify(map));
console.log(`map.json: ${districts.length} districts, ${roads.length} roads, ${landmarks.length} landmarks (from ${nodes.length} nodes)`);
