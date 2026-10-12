// The 3D city: districts (graphify communities) on the ground, buildings for
// their most connected nodes, roads for links between districts, floating
// landmarks for the god nodes, and a physics ball the player drives around.

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, Text, useKeyboardControls, Sky } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider, CylinderCollider, BallCollider, type RapierRigidBody, type IntersectionEnterPayload } from "@react-three/rapier";
import { Vector3, type Mesh } from "three";
import type { CodeMap, District, Landmark, Selection } from "./types";

export const PLAYER = "player";
const SPAWN: [number, number, number] = [0, 3, 0];
const FALL_LIMIT = -15;
const MOVE_FORCE = 0.9;
const JUMP_IMPULSE = 4;
const CAMERA_OFFSET = new Vector3(0, 30, 24);

const isPlayer = (p: IntersectionEnterPayload) => p.other.rigidBodyObject?.name === PLAYER;
const heightOf = (degree: number) => 0.5 + Math.log2(degree + 1) * 0.55;

interface WorldProps {
  map: CodeMap;
  discovered: ReadonlySet<string>;
  collected: ReadonlySet<string>;
  selection: Selection;
  onDiscover: (id: string) => void;
  onCollect: (id: string) => void;
  onSelect: (s: Selection) => void;
}

function Player() {
  const body = useRef<RapierRigidBody>(null);
  const [, get] = useKeyboardControls();
  const { camera } = useThree();
  const target = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const b = body.current;
    if (!b) return;
    const { forward, back, left, right, jump } = get() as Record<string, boolean>;
    b.applyImpulse({ x: ((right ? 1 : 0) - (left ? 1 : 0)) * MOVE_FORCE, y: 0, z: ((back ? 1 : 0) - (forward ? 1 : 0)) * MOVE_FORCE }, true);
    const v = b.linvel();
    if (jump && Math.abs(v.y) < 0.05) b.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true);
    const p = b.translation();
    if (p.y < FALL_LIMIT) {
      b.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    target.set(p.x, p.y, p.z);
    camera.position.lerp(target.clone().add(CAMERA_OFFSET), 0.08);
    camera.lookAt(target);
  });

  return (
    <RigidBody ref={body} name={PLAYER} position={SPAWN} colliders={false} linearDamping={1.2} angularDamping={0.8} mass={1}>
      <BallCollider args={[0.8]} friction={1.5} restitution={0.2} />
      <mesh castShadow>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color="#f8cb2e" emissive="#f8cb2e" emissiveIntensity={0.25} roughness={0.3} />
      </mesh>
    </RigidBody>
  );
}

function DistrictBlock({ d, color, found, selected, onDiscover, onSelect }: {
  d: District; color: string; found: boolean; selected: boolean; onDiscover: (id: string) => void; onSelect: (s: Selection) => void;
}) {
  const ring = d.radius * 0.62;
  return (
    <group position={[d.x, 0, d.z]}>
      <mesh receiveShadow position={[0, 0.1, 0]} onClick={(e) => { e.stopPropagation(); onSelect({ kind: "district", id: d.id }); }}>
        <cylinderGeometry args={[d.radius, d.radius, 0.2, 40]} />
        <meshStandardMaterial color={color} transparent opacity={found ? 0.85 : 0.35} emissive={selected ? color : "#000"} emissiveIntensity={selected ? 0.5 : 0} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider sensor args={[2, d.radius]} position={[0, 2, 0]} onIntersectionEnter={(p) => { if (isPlayer(p)) onDiscover(d.id); }} />
      </RigidBody>
      {d.top.map((n, i) => {
        const h = heightOf(n.degree);
        const a = (i / d.top.length) * Math.PI * 2;
        const pos: [number, number, number] = i === 0 ? [0, h / 2 + 0.2, 0] : [Math.cos(a) * ring, h / 2 + 0.2, Math.sin(a) * ring];
        const w = i === 0 ? 1.4 : 0.9;
        return (
          <RigidBody key={n.id} type="fixed" colliders="cuboid" position={pos}>
            <mesh castShadow onClick={(e) => { e.stopPropagation(); onSelect({ kind: "district", id: d.id }); }}>
              <boxGeometry args={[w, h, w]} />
              <meshStandardMaterial color={found ? color : "#cbd5e0"} roughness={0.6} />
            </mesh>
          </RigidBody>
        );
      })}
      <Billboard position={[0, heightOf(d.top[0]?.degree ?? 1) + 1.6, 0]}>
        <Text fontSize={Math.max(0.7, d.radius * 0.22)} color={found ? "#1a202c" : "#718096"} outlineWidth={0.04} outlineColor="#ffffff" anchorY="bottom">
          {found ? d.name : "?"}
        </Text>
      </Billboard>
    </group>
  );
}

/** A god node: a spinning gem floating just outside its district, low enough to roll or jump into. */
function LandmarkOrb({ l, at, onCollect }: { l: Landmark; at: District; onCollect: (id: string) => void }) {
  const mesh = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.position.y = Math.sin(clock.elapsedTime * 2 + at.x) * 0.25;
      mesh.current.rotation.y = clock.elapsedTime;
    }
  });
  return (
    <group position={[at.x + at.radius + 2.2, 1.8, at.z]}>
      <RigidBody type="fixed" colliders={false}>
        <BallCollider sensor args={[1.8]} onIntersectionEnter={(p) => { if (isPlayer(p)) onCollect(l.id); }} />
      </RigidBody>
      <mesh ref={mesh} castShadow>
        <octahedronGeometry args={[0.9]} />
        <meshStandardMaterial color="#9f7aea" emissive="#b794f4" emissiveIntensity={0.9} />
      </mesh>
      <pointLight color="#b794f4" intensity={6} distance={6} />
    </group>
  );
}

function Roads({ map }: { map: CodeMap }) {
  const at = useMemo(() => new Map(map.districts.map((d) => [d.id, d])), [map]);
  const max = Math.max(1, ...map.roads.map((r) => r.weight));
  return (
    <>
      {map.roads.map((r) => {
        const a = at.get(r.a);
        const b = at.get(r.b);
        if (!a || !b) return null;
        return <Line key={`${r.a}|${r.b}`} points={[[a.x, 0.25, a.z], [b.x, 0.25, b.z]]} color="#4a5568" transparent opacity={0.25 + 0.5 * (r.weight / max)} lineWidth={1 + 3 * (r.weight / max)} />;
      })}
    </>
  );
}

export function World({ map, discovered, collected, selection, onDiscover, onCollect, onSelect }: WorldProps) {
  const color = useMemo(() => new Map(map.areas.map((a) => [a.id, a.color])), [map]);
  const byId = useMemo(() => new Map(map.districts.map((d) => [d.id, d])), [map]);
  const size = Math.max(...map.districts.map((d) => Math.max(Math.abs(d.x), Math.abs(d.z)) + d.radius)) + 12;

  return (
    <Canvas shadows camera={{ position: [0, 30, 30], fov: 50 }} onPointerMissed={() => onSelect(null)}>
      <Sky sunPosition={[100, 60, 50]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[40, 60, 30]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-size} shadow-camera-right={size} shadow-camera-top={size} shadow-camera-bottom={-size} />
      <Physics gravity={[0, -20, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[size, 0.5, size]} position={[0, -0.5, 0]} />
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[size * 2, size * 2]} />
            <meshStandardMaterial color="#edf2f7" />
          </mesh>
        </RigidBody>
        <Roads map={map} />
        {map.districts.map((d) => (
          <DistrictBlock key={d.id} d={d} color={color.get(d.area) ?? "#a0aec0"} found={discovered.has(d.id)} selected={selection?.kind === "district" && selection.id === d.id} onDiscover={onDiscover} onSelect={onSelect} />
        ))}
        {map.landmarks.map((l) => {
          const at = byId.get(l.district);
          if (!at) return null;
          return (
            collected.has(l.id) ? null : <LandmarkOrb key={l.id} l={l} at={at} onCollect={onCollect} />
          );
        })}
        <Player />
      </Physics>
    </Canvas>
  );
}
