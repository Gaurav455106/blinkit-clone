// Shape of public/map.json (written by scripts/build-map.mjs).

export interface Area {
  id: string;
  label: string;
  color: string;
  angle: number;
}

export interface TopNode {
  id: string;
  label: string;
  file: string;
  degree: number;
}

export interface District {
  id: string;
  name: string;
  area: string;
  nodes: number;
  files: string[];
  fileCount: number;
  top: TopNode[];
  radius: number;
  x: number;
  z: number;
  links: number;
}

export interface Road {
  a: string;
  b: string;
  weight: number;
}

export interface Landmark {
  id: string;
  label: string;
  file: string;
  degree: number;
  district: string;
}

export interface CodeMap {
  builtAt: string;
  commit: string | null;
  totals: { nodes: number; links: number; districts: number };
  areas: Area[];
  districts: District[];
  roads: Road[];
  landmarks: Landmark[];
}

export type Selection = { kind: "district"; id: string } | { kind: "landmark"; id: string } | null;
