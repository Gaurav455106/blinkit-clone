// The code planet: districts (graphify communities) on a globe, buildings for
// their most connected nodes, arcs for links between districts, and the god
// nodes as moons in orbit. Drag to spin, scroll to zoom, click to land.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { BackSide, Quaternion, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CodeMap, Selection } from "./types";
import { arc, placeDistricts, PLANET_RADIUS, type Placed } from "./planetLayout";
import { Moons } from "./Moons";

const UP = new Vector3(0, 1, 0);
const FOCUS_DISTANCE = 26;
const heightOf = (degree: number) => 0.4 + Math.log2(degree + 1) * 0.45;

interface WorldProps {
  map: CodeMap;
  discovered: ReadonlySet<string>;
  collected: ReadonlySet<string>;
  selection: Selection;
  onDiscover: (id: string) => void;
  onCollect: (id: string) => void;
  onSelect: (s: Selection) => void;
}

interface SpotProps {
  p: Placed;
  color: string;
  found: boolean;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onLand: (id: string) => void;
}

function DistrictSpot({ p, color, found, selected, hovered, onHover, onLand }: SpotProps) {
  const { district: d, normal, size } = p;
  const quat = useMemo(() => new Quaternion().setFromUnitVectors(UP, normal), [normal]);
  const pos = useMemo(() => normal.clone().multiplyScalar(PLANET_RADIUS), [normal]);
  const lit = selected || hovered;
  const handlers = {
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onHover(d.id); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { onHover(null); document.body.style.cursor = "auto"; },
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onLand(d.id); },
  };
  return (
    <group position={pos} quaternion={quat}>
      <mesh position={[0, 0.06, 0]} {...handlers}>
        <cylinderGeometry args={[size, size, 0.12, 36]} />
        <meshStandardMaterial color={color} transparent opacity={found ? 0.95 : 0.45} emissive={color} emissiveIntensity={lit ? 0.7 : found ? 0.15 : 0} />
      </mesh>
      {d.top.map((n, i) => {
        const h = heightOf(n.degree) * (found ? 1 : 0.5);
        const a = (i / d.top.length) * Math.PI * 2;
        const r = i === 0 ? 0 : size * 0.6;
        const w = i === 0 ? 0.9 : 0.55;
        return (
          <mesh key={n.id} position={[Math.cos(a) * r, h / 2 + 0.12, Math.sin(a) * r]} {...handlers}>
            <boxGeometry args={[w, h, w]} />
            <meshStandardMaterial color={found ? "#f7fafc" : "#a0aec0"} emissive={lit ? color : "#000"} emissiveIntensity={lit ? 0.4 : 0} />
          </mesh>
        );
      })}
      {(found || hovered) && (
        <Billboard position={[0, heightOf(d.top[0]?.degree ?? 1) + 1.2, 0]}>
          <Text fontSize={hovered ? 1.2 : 0.8} color="#ffffff" outlineWidth={0.05} outlineColor="#1a202c" anchorY="bottom">
            {found ? d.name : "? Click to land"}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function Roads({ placed, map }: { placed: readonly Placed[]; map: CodeMap }) {
  const at = useMemo(() => new Map(placed.map((p) => [p.district.id, p.normal])), [placed]);
  const max = Math.max(1, ...map.roads.map((r) => r.weight));
  const lines = useMemo(() => map.roads.flatMap((r) => {
    const a = at.get(r.a);
    const b = at.get(r.b);
    return a && b ? [{ key: `${r.a}|${r.b}`, points: arc(a, b), w: r.weight / max }] : [];
  }), [map, at, max]);
  return <>{lines.map((l) => <Line key={l.key} points={l.points} color="#90cdf4" transparent opacity={0.15 + 0.45 * l.w} lineWidth={0.6 + 2 * l.w} />)}</>;
}

function Globe() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[PLANET_RADIUS, 96, 96]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh scale={1.12}>
        <sphereGeometry args={[PLANET_RADIUS, 64, 64]} />
        <meshBasicMaterial color="#63b3ed" transparent opacity={0.08} side={BackSide} />
      </mesh>
    </>
  );
}

/** Orbit controls that spin on their own until you touch them, and fly to a landed district. */
function CameraRig({ focus }: { focus: Vector3 | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const [touched, setTouched] = useState(false);
  const flying = useRef<Vector3 | null>(null);

  useEffect(() => {
    if (focus) flying.current = focus.clone().multiplyScalar(PLANET_RADIUS + FOCUS_DISTANCE);
  }, [focus]);

  useFrame(() => {
    const goal = flying.current;
    if (!goal) return;
    camera.position.lerp(goal, 0.06);
    controls.current?.update();
    if (camera.position.distanceTo(goal) < 0.5) flying.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      minDistance={PLANET_RADIUS + 8}
      maxDistance={PLANET_RADIUS * 5}
      autoRotate={!touched}
      autoRotateSpeed={0.4}
      onStart={() => { setTouched(true); flying.current = null; }}
    />
  );
}

export function World({ map, discovered, collected, selection, onDiscover, onCollect, onSelect }: WorldProps) {
  const color = useMemo(() => new Map(map.areas.map((a) => [a.id, a.color])), [map]);
  const placed = useMemo(() => placeDistricts(map), [map]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focus, setFocus] = useState<Vector3 | null>(null);

  const land = (id: string) => {
    const p = placed.find((x) => x.district.id === id);
    if (p) setFocus(p.normal.clone());
    onDiscover(id);
    onSelect({ kind: "district", id });
  };

  return (
    <Canvas camera={{ position: [0, 20, PLANET_RADIUS * 3.2], fov: 45 }} onPointerMissed={() => onSelect(null)}>
      <color attach="background" args={["#05070f"]} />
      <Stars radius={300} depth={80} count={4000} factor={5} fade speed={0.6} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[80, 60, 60]} intensity={1.6} />
      <pointLight position={[-90, -40, -60]} intensity={400} color="#805ad5" />
      <Globe />
      <Roads placed={placed} map={map} />
      {placed.map((p) => (
        <DistrictSpot
          key={p.district.id}
          p={p}
          color={color.get(p.district.area) ?? "#a0aec0"}
          found={discovered.has(p.district.id)}
          selected={selection?.kind === "district" && selection.id === p.district.id}
          hovered={hovered === p.district.id}
          onHover={setHovered}
          onLand={land}
        />
      ))}
      <Physics gravity={[0, 0, 0]}>
        <Moons landmarks={map.landmarks} captured={collected} onCapture={onCollect} />
      </Physics>
      <CameraRig focus={focus} />
    </Canvas>
  );
}
