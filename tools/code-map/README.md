# Code Map

A 3D planet of the blinkit-clone codebase, built from `graphify-out/graph.json`.

- **Districts** on the globe are graphify communities, coloured by area (market engine, pages, components, logic, docs…). Each area owns a wedge of the planet.
- **Buildings** are each district's most connected nodes; taller means more connections.
- **Arcs** are links between districts; brighter means more links.
- **Moons** are the 12 most connected nodes ("god nodes"), kept in orbit by Rapier physics (inverse-square gravity).

Drag to spin the planet, scroll to zoom, click a district to land on it (reveals it, +10 XP),
click a moon to capture it (+50 XP, it flies off). Levels, per-area progress and achievements
are saved in this browser.

```bash
cd tools/code-map
npm install
npm run dev      # rebuilds map.json from graphify-out, then opens http://localhost:5180
```

After code changes, run `graphify update .` in the repo root, then restart `npm run dev`.

Runs separately from the simulation app, so three.js and Rapier physics never reach the student bundle.
