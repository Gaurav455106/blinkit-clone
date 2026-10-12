// Overlay: level and XP, progress per area, achievements, the open district or
// landmark, pop-up toasts, and the controls.

import type { CodeMap, Selection } from "./types";
import { ACHIEVEMENTS, levelOf, XP_PER_LEVEL, type Progress } from "./progress";

export interface Toast {
  id: number;
  text: string;
  kind: "district" | "landmark" | "achievement";
}

interface HudProps {
  map: CodeMap;
  progress: Progress;
  xp: number;
  selection: Selection;
  toasts: readonly Toast[];
  onClose: () => void;
  onReset: () => void;
}

function Stats({ map, progress, xp }: Pick<HudProps, "map" | "progress" | "xp">) {
  const level = levelOf(xp);
  const into = xp % XP_PER_LEVEL;
  return (
    <section className="card stats">
      <h1>Code Map</h1>
      <p className="muted">blinkit-clone · {map.totals.nodes.toLocaleString()} nodes · {map.totals.links.toLocaleString()} links</p>
      <div className="level">
        <span className="badge">Level {level}</span>
        <span className="muted">{xp} XP</span>
      </div>
      <div className="bar"><div style={{ width: `${(into / XP_PER_LEVEL) * 100}%` }} /></div>
      <p className="row"><span>Districts</span><b>{progress.discovered.length} / {map.districts.length}</b></p>
      <p className="row"><span>Landmarks</span><b>{progress.collected.length} / {map.landmarks.length}</b></p>
      <ul className="areas">
        {map.areas.map((a) => {
          const all = map.districts.filter((d) => d.area === a.id);
          const found = all.filter((d) => progress.discovered.includes(d.id)).length;
          return (
            <li key={a.id}>
              <i style={{ background: a.color }} />
              <span>{a.label}</span>
              <b>{found}/{all.length}</b>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Achievements({ map, progress, onReset }: Pick<HudProps, "map" | "progress" | "onReset">) {
  return (
    <section className="card achievements">
      <h2>Achievements</h2>
      <ul>
        {ACHIEVEMENTS.map((a) => {
          const done = a.done(progress, map);
          return (
            <li key={a.id} className={done ? "done" : ""}>
              <span className="tick">{done ? "★" : "☆"}</span>
              <span><b>{a.title}</b><br /><small>{a.detail}</small></span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="link" onClick={onReset}>Reset progress</button>
    </section>
  );
}

function Detail({ map, selection, progress, onClose }: Pick<HudProps, "map" | "selection" | "progress" | "onClose">) {
  if (!selection) return null;
  if (selection.kind === "landmark") {
    const l = map.landmarks.find((x) => x.id === selection.id);
    if (!l) return null;
    const home = map.districts.find((d) => d.id === l.district);
    return (
      <section className="card detail">
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">Landmark · god node</p>
        <h2>{l.label}</h2>
        <p className="muted">{l.file}</p>
        <p className="row"><span>Connections</span><b>{l.degree}</b></p>
        {home && <p className="row"><span>District</span><b>{home.name}</b></p>}
      </section>
    );
  }
  const d = map.districts.find((x) => x.id === selection.id);
  if (!d) return null;
  const area = map.areas.find((a) => a.id === d.area);
  const found = progress.discovered.includes(d.id);
  return (
    <section className="card detail">
      <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
      <p className="eyebrow" style={{ color: area?.color }}>{area?.label}</p>
      <h2>{found ? d.name : "Undiscovered district"}</h2>
      {!found && <p className="muted">Roll the ball onto it to reveal what's inside.</p>}
      {found && (
        <>
          <p className="row"><span>Nodes</span><b>{d.nodes}</b></p>
          <p className="row"><span>Files</span><b>{d.fileCount}</b></p>
          <p className="row"><span>Links to other districts</span><b>{d.links}</b></p>
          <h3>Tallest buildings</h3>
          <ol>{d.top.map((n) => <li key={n.id}><span>{n.label}</span><small>{n.degree}</small></li>)}</ol>
          <h3>Files</h3>
          <ul className="files">{d.files.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}
    </section>
  );
}

export function Hud(props: HudProps) {
  return (
    <div className="hud">
      <Stats map={props.map} progress={props.progress} xp={props.xp} />
      <Achievements map={props.map} progress={props.progress} onReset={props.onReset} />
      <Detail map={props.map} selection={props.selection} progress={props.progress} onClose={props.onClose} />
      <div className="toasts" aria-live="polite">
        {props.toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
      <p className="controls">WASD or arrows to roll · Space to jump · Click a district to inspect it</p>
    </div>
  );
}
