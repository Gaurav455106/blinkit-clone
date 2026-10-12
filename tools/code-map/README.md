# Code Map

A 3D, explorable map of the blinkit-clone codebase, built from `graphify-out/graph.json`.

- **Districts** are graphify communities, coloured by area (market engine, pages, components, logic, docs…).
- **Buildings** are each district's most connected nodes; taller means more connections.
- **Roads** are links between districts; thicker means more links.
- **Purple gems** are the 12 most connected nodes ("god nodes").

Roll the ball (WASD or arrows, Space to jump) onto districts to discover them and earn XP,
collect the gems, and unlock achievements. Progress is saved in this browser.

```bash
cd tools/code-map
npm install
npm run dev      # rebuilds map.json from graphify-out, then opens http://localhost:5180
```

After code changes, run `graphify update .` in the repo root, then restart `npm run dev`.

Runs separately from the simulation app, so three.js and Rapier physics never reach the student bundle.
