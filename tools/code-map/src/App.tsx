// Loads map.json, keeps exploration progress, and wires the 3D world to the HUD.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { World } from "./World";
import { Hud, type Toast } from "./Hud";
import { ACHIEVEMENTS, EMPTY, loadProgress, saveProgress, xpOf, XP_DISTRICT, XP_LANDMARK, type Progress } from "./progress";
import type { CodeMap, Selection } from "./types";

const TOAST_MS = 2600;

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; map: CodeMap };

function useMap(): Load {
  const [state, setState] = useState<Load>({ status: "loading" });
  useEffect(() => {
    fetch("/map.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`map.json returned ${r.status}`))))
      .then((map: CodeMap) => setState({ status: "ready", map }))
      .catch((err: unknown) => setState({ status: "error", message: err instanceof Error ? err.message : String(err) }));
  }, []);
  return state;
}

function Game({ map }: { map: CodeMap }) {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [selection, setSelection] = useState<Selection>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToast = useRef(0);

  const toast = useCallback((text: string, kind: Toast["kind"]) => {
    const id = ++nextToast.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  // The latest progress, read by the sensor callbacks so side effects run once per pickup
  const current = useRef(progress);
  const update = useCallback((after: Progress, announce: () => void) => {
    const prev = current.current;
    current.current = after;
    setProgress(after);
    saveProgress(after);
    announce();
    for (const a of ACHIEVEMENTS) if (a.done(after, map) && !a.done(prev, map)) toast(`Achievement: ${a.title}`, "achievement");
  }, [map, toast]);

  const onDiscover = useCallback((id: string) => {
    const d = map.districts.find((x) => x.id === id);
    const p = current.current;
    if (p.discovered.includes(id)) return;
    update(
      { ...p, discovered: [...p.discovered, id] },
      () => { toast(`+${XP_DISTRICT} XP · ${d?.name ?? "District"} discovered`, "district"); setSelection({ kind: "district", id }); },
    );
  }, [map, update, toast]);

  const onCollect = useCallback((id: string) => {
    const l = map.landmarks.find((x) => x.id === id);
    const p = current.current;
    if (p.collected.includes(id)) return;
    update(
      { ...p, collected: [...p.collected, id] },
      () => { toast(`+${XP_LANDMARK} XP · Moon captured: ${l?.label ?? "god node"}`, "landmark"); setSelection({ kind: "landmark", id }); },
    );
  }, [map, update, toast]);

  const discovered = useMemo(() => new Set(progress.discovered), [progress.discovered]);
  const collected = useMemo(() => new Set(progress.collected), [progress.collected]);

  const reset = () => {
    current.current = EMPTY;
    saveProgress(EMPTY);
    setProgress(EMPTY);
    setSelection(null);
  };

  return (
    <>
      <Suspense fallback={<p className="center">Forming the planet…</p>}>
        <World map={map} discovered={discovered} collected={collected} selection={selection} onDiscover={onDiscover} onCollect={onCollect} onSelect={setSelection} />
      </Suspense>
      <Hud map={map} progress={progress} xp={xpOf(progress)} selection={selection} toasts={toasts} onClose={() => setSelection(null)} onReset={reset} />
    </>
  );
}

export default function App() {
  const state = useMap();
  if (state.status === "loading") return <p className="center">Loading the map…</p>;
  if (state.status === "error") return <p className="center">Couldn't load map.json ({state.message}). Run <code>npm run map</code>.</p>;
  return <Game map={state.map} />;
}
