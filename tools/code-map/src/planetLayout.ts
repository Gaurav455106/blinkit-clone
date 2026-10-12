// Places districts on a sphere. Points come from a Fibonacci spiral (even spacing),
// sorted by longitude, and handed out area by area, so each area owns a wedge of
// the planet and its biggest districts sit nearest the equator.

import { Vector3 } from "three";
import type { CodeMap, District } from "./types";

export const PLANET_RADIUS = 30;

export interface Placed {
  district: District;
  /** Unit normal: the district's spot on the planet. */
  normal: Vector3;
  /** Disc radius on the surface. */
  size: number;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** Keep districts off the poles, where discs would bunch up. */
const MAX_LAT = 0.82;

function fibonacci(n: number): Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const y = (1 - (2 * (i + 0.5)) / n) * MAX_LAT;
    const r = Math.sqrt(1 - y * y);
    const theta = GOLDEN * i;
    return new Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).normalize();
  });
}

export function placeDistricts(map: CodeMap): Placed[] {
  const order = new Map(map.areas.map((a, i) => [a.id, i]));
  const districts = [...map.districts].sort((a, b) => (order.get(a.area) ?? 99) - (order.get(b.area) ?? 99) || b.nodes - a.nodes);
  const lon = (v: Vector3) => Math.atan2(v.z, v.x);
  const points = fibonacci(districts.length).sort((a, b) => lon(a) - lon(b));
  // Within each area's wedge, put the biggest districts nearest the equator
  const placed: Placed[] = [];
  let start = 0;
  for (const area of map.areas) {
    const members = districts.filter((d) => d.area === area.id);
    const wedge = points.slice(start, start + members.length).sort((a, b) => Math.abs(a.y) - Math.abs(b.y));
    members.forEach((d, i) => placed.push({ district: d, normal: wedge[i], size: Math.min(4.2, 1.3 + Math.sqrt(d.nodes) * 0.32) }));
    start += members.length;
  }
  return placed;
}

/** Points along the great circle from a to b, lifted off the surface into an arc. */
export function arc(a: Vector3, b: Vector3, radius = PLANET_RADIUS, lift = 1.2, steps = 24): Vector3[] {
  const angle = a.angleTo(b);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const p = a.clone().multiplyScalar(Math.sin((1 - t) * angle)).add(b.clone().multiplyScalar(Math.sin(t * angle))).divideScalar(Math.sin(angle) || 1);
    return p.normalize().multiplyScalar(radius + 0.3 + Math.sin(Math.PI * t) * lift * (1 + angle));
  });
}
