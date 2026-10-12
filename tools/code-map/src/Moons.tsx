// The god nodes as moons: Rapier bodies kept in orbit by a pull toward the planet
// (inverse-square gravity applied every frame). Click a moon to capture it; a
// captured moon gets a kick and flies off.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { RigidBody, BallCollider, type RapierRigidBody } from "@react-three/rapier";
import type { Landmark } from "./types";
import { PLANET_RADIUS } from "./planetLayout";

/** GM in the gravity law; orbital speed at radius r is sqrt(GM / r). */
const GM = 2400;
const ESCAPE_KICK = 25;
const GONE_DISTANCE = 400;
/** Click target size relative to the moon. */
const HIT_SCALE = 2.2;

interface MoonProps {
  l: Landmark;
  index: number;
  count: number;
  captured: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onCapture: (id: string) => void;
}

function Moon({ l, index, count, captured, hovered, onHover, onCapture }: MoonProps) {
  const body = useRef<RapierRigidBody>(null);
  const [gone, setGone] = useState(captured);
  // Each moon gets its own orbit: radius, tilt and phase
  const start = useMemo(() => {
    const r = PLANET_RADIUS + 9 + (index % 4) * 3.5;
    const phase = (index / count) * Math.PI * 2;
    const tilt = ((index * 37) % 60 - 30) * (Math.PI / 180);
    const pos = { x: Math.cos(phase) * r, y: Math.sin(phase) * Math.sin(tilt) * r, z: Math.sin(phase) * Math.cos(tilt) * r };
    const speed = Math.sqrt(GM / r);
    const vel = { x: -Math.sin(phase) * speed, y: Math.cos(phase) * Math.sin(tilt) * speed, z: Math.cos(phase) * Math.cos(tilt) * speed };
    return { pos, vel, size: 0.9 + Math.min(1.4, l.degree / 200) };
  }, [index, count, l.degree]);

  useEffect(() => {
    body.current?.setLinvel(start.vel, true);
  }, [start]);

  useEffect(() => {
    const b = body.current;
    if (!captured || !b) return;
    const p = b.translation();
    const len = Math.hypot(p.x, p.y, p.z) || 1;
    b.applyImpulse({ x: (p.x / len) * ESCAPE_KICK * b.mass(), y: (p.y / len) * ESCAPE_KICK * b.mass(), z: (p.z / len) * ESCAPE_KICK * b.mass() }, true);
  }, [captured]);

  useFrame(() => {
    const b = body.current;
    if (!b || gone) return;
    const p = b.translation();
    const d2 = p.x * p.x + p.y * p.y + p.z * p.z;
    const d = Math.sqrt(d2);
    if (captured && d > GONE_DISTANCE) { setGone(true); return; }
    if (captured) return;
    const f = (GM * b.mass()) / d2;
    b.resetForces(true);
    b.addForce({ x: (-p.x / d) * f, y: (-p.y / d) * f, z: (-p.z / d) * f }, true);
  });

  if (gone) return null;
  return (
    <RigidBody ref={body} position={[start.pos.x, start.pos.y, start.pos.z]} colliders={false} linearDamping={0} angularDamping={0} gravityScale={0}>
      <BallCollider args={[start.size]} />
      <mesh>
        <sphereGeometry args={[start.size, 24, 24]} />
        <meshStandardMaterial color={captured ? "#faf089" : "#b794f4"} emissive={hovered ? "#e9d8fd" : "#6b46c1"} emissiveIntensity={hovered ? 1.2 : 0.6} roughness={0.4} />
      </mesh>
      {/* A larger invisible target, so a moving moon is easy to click */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onHover(l.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); if (!captured) onCapture(l.id); }}
      >
        <sphereGeometry args={[start.size * HIT_SCALE, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hovered && (
        <Billboard position={[0, start.size + 0.9, 0]}>
          <Text fontSize={1.1} color="#ffffff" outlineWidth={0.05} outlineColor="#2d1b69" anchorY="bottom">{l.label}</Text>
        </Billboard>
      )}
    </RigidBody>
  );
}

interface MoonsProps {
  landmarks: readonly Landmark[];
  captured: ReadonlySet<string>;
  onCapture: (id: string) => void;
}

export function Moons({ landmarks, captured, onCapture }: MoonsProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <>
      {landmarks.map((l, i) => (
        <Moon key={l.id} l={l} index={i} count={landmarks.length} captured={captured.has(l.id)} hovered={hovered === l.id} onHover={setHovered} onCapture={onCapture} />
      ))}
    </>
  );
}
