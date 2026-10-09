# Flood-Ready Access: web app

React 19 + TypeScript + Vite. Pages: **Brief** (`/`), **Evidence** (`/evidence`), **Calculator** (`/calculator`).
The Calculator talks to the Python engine through `/api` (see `floodready/api.py`); the other two read static JSON in
`public/data/`.

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to http://127.0.0.1:8000
npm run build      # type-check, then bundle to dist/ (served by `python -m floodready serve`)
```

Start the API from the repository root with `python -m floodready serve`.

## Layout

```
src/pages/Landing.tsx            scroll-driven hero, problem, pipeline, findings, team
src/pages/Evidence.tsx           the brief and the build, with evidence/ (Part1, Part2, figs1-3)
src/pages/calculator/            controls, hooks (API), store (zustand), panels
src/components/map/MapCanvas.tsx canvas map (no tiles): pan, zoom, click-to-cut, hub placement, routes
src/components/charts/kit.tsx    small SVG chart toolkit on d3 scales
src/presenter/                   talk-track steps for presenter mode (Shift+P)
public/data/                     geometry.json, scenarios.json, evidence.json (python -m floodready export)
```

Design: editorial / science-journal. Fonts are self-hosted (Fraunces, Inter Tight, JetBrains Mono) and maps need no tile
server, so the app works offline. Every figure carries a provenance stamp: **real** data, **generated** input, or **computed**
result. Motion respects `prefers-reduced-motion`.
