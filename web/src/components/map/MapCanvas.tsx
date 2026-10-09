import { ReactNode, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import type { Geometry } from "../../lib/types";

/* A hand-built canvas map of Cachar. No tiles: roads, rivers, villages and facilities are drawn straight from the data,
   so it works offline and reads like a figure in a paper. Pan and zoom are built in; tools turn clicks into edits. */

export const STATUS_COLOR = ["#2f6b5e", "#c98a1b", "#c0392b", "#9c9486"]; // ok, delayed, cut off, unconnected
const INK = "#14110f", PAPER = "#f4efe6", FLOOD = "#1d4e89", CUT = "#c0392b";
const ROAD_W: Record<string, number> = { NH: 1.9, SH: 1.5, MDR: 1.2, "RR(ODR)": 0.95, "RR(VR)": 0.75, BR: 0.75, "RR(TRACK)": 0.5 };
const HEAT_STOPS = ["#e9dfca", "#e3b98a", "#c0392b", "#6f160d"];
const TIME_STOPS = ["#2f6b5e", "#8aa05a", "#c98a1b", "#c0392b"];

export type Tool = "pan" | "cut" | "hub" | "out";
export interface Layers { rivers?: boolean; roads?: boolean; villages?: boolean; facilities?: boolean; routes?: boolean; hubs?: boolean }
export interface MapHandle { fit: () => void; zoomBy: (f: number) => void; focus: (lon: number, lat: number, zoom?: number) => void }

interface Props {
  geo: Geometry;
  layers?: Layers;
  cut?: ReadonlySet<number>;
  cutOrder?: number[];
  cutReveal?: number;
  villageMode?: "neutral" | "status" | "heat" | "time";
  villageStatus?: ArrayLike<number> | null;
  villageValues?: ArrayLike<number | null> | null; // heat: 0..1, time: minutes
  facilityOut?: ReadonlySet<number>;
  facilityDeliver?: ReadonlyMap<number, number>;
  hubs?: { lon: number; lat: number }[];
  depot?: boolean;
  routes?: { path: [number, number][]; units: number }[];
  routesOn?: boolean;
  highlightRoads?: ReadonlySet<number>;
  highlightColor?: string;
  pulseRoads?: ReadonlySet<number>;
  interactive?: boolean;
  tool?: Tool;
  onRoad?: (id: number) => void;
  onFacility?: (id: number) => void;
  onPoint?: (lon: number, lat: number) => void;
  tip?: (kind: "village" | "facility" | "road", idx: number) => ReactNode;
  className?: string;
  padding?: number;
  fitKey?: unknown;
  focusTarget?: { lon: number; lat: number; zoom: number } | null;
  controls?: boolean;
  bg?: string | null;
}

interface RoadW { id: number; cat: string; path: Path2D; bbox: [number, number, number, number]; pts: Float32Array[] }

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(stops: string[], t: number): [number, number, number] {
  const c = stops.map(hex);
  const x = Math.min(Math.max(t, 0), 1) * (c.length - 1), i = Math.min(Math.floor(x), c.length - 2), f = x - i;
  return [c[i][0] + (c[i + 1][0] - c[i][0]) * f, c[i][1] + (c[i + 1][1] - c[i][1]) * f, c[i][2] + (c[i + 1][2] - c[i][2]) * f];
}

export const MapCanvas = forwardRef<MapHandle, Props>(function MapCanvas(props, ref) {
  const { geo, className, padding = 18, controls = true } = props;
  const wrap = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const P = useRef(props); P.current = props;
  const [tip, setTip] = useState<{ x: number; y: number; kind: "village" | "facility" | "road"; idx: number } | null>(null);
  const [grab, setGrab] = useState(false);

  // ---- projection: equirectangular, kilometres
  const world = useMemo(() => {
    const [lo0, la0, lo1, la1] = geo.bounds;
    const lat0 = (la0 + la1) / 2, kx = Math.cos((lat0 * Math.PI) / 180) * 111.32, ky = 110.57, lon0 = (lo0 + lo1) / 2;
    const px = (lon: number) => (lon - lon0) * kx, py = (lat: number) => -(lat - lat0) * ky;
    const inv = (x: number, y: number): [number, number] => [x / kx + lon0, -y / ky + lat0];
    const roads: RoadW[] = geo.roads.map((r) => {
      const path = new Path2D(), pts: Float32Array[] = [];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const part of r.p) {
        const a = new Float32Array(part.length);
        for (let i = 0; i < part.length; i += 2) {
          const x = px(part[i]), y = py(part[i + 1]);
          a[i] = x; a[i + 1] = y;
          i === 0 ? path.moveTo(x, y) : path.lineTo(x, y);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        pts.push(a);
      }
      return { id: r.id, cat: r.c, path, bbox: [x0, y0, x1, y1], pts };
    });
    const byId = new Map(roads.map((r) => [r.id, r]));
    const byCat = new Map<string, Path2D>();
    for (const r of roads) { if (!byCat.has(r.cat)) byCat.set(r.cat, new Path2D()); byCat.get(r.cat)!.addPath(r.path); }
    const rivers = geo.rivers.map((r) => { const p = new Path2D(); for (let i = 0; i < r.p.length; i += 2) { const x = px(r.p[i]), y = py(r.p[i + 1]); i === 0 ? p.moveTo(x, y) : p.lineTo(x, y); } return { p, k: r.k }; });
    const V = geo.villages, F = geo.facilities;
    const vx = Float32Array.from(V.lon, px), vy = Float32Array.from(V.lat, py), fx = Float32Array.from(F.lon, px), fy = Float32Array.from(F.lat, py);
    const maxPop = Math.max(...V.pop);
    const vr = Float32Array.from(V.pop, (p) => 1.3 + 8.5 * Math.sqrt(p / maxPop));
    const hullPath = new Path2D();
    let hx0 = 1e9, hy0 = 1e9, hx1 = -1e9, hy1 = -1e9;
    for (let i = 0; i < geo.hull.length; i += 2) {
      const x = px(geo.hull[i]), y = py(geo.hull[i + 1]);
      i === 0 ? hullPath.moveTo(x, y) : hullPath.lineTo(x, y);
      hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y);
    }
    hullPath.closePath();
    return { px, py, inv, roads, byId, byCat, rivers, hullPath, vx, vy, fx, fy, vr, bounds: [hx0, hy0, hx1, hy1] };
  }, [geo]);

  const cutPath = useMemo(() => {
    const p = new Path2D();
    const order = props.cutOrder ?? (props.cut ? [...props.cut] : []);
    const n = Math.round(order.length * Math.min(Math.max(props.cutReveal ?? 1, 0), 1));
    for (let i = 0; i < n; i++) { const r = world.byId.get(order[i]); if (r) p.addPath(r.path); }
    return p;
  }, [world, props.cut, props.cutOrder, props.cutReveal]);
  const hiPath = useMemo(() => { const p = new Path2D(); props.highlightRoads?.forEach((id) => { const r = world.byId.get(id); if (r) p.addPath(r.path); }); return p; }, [world, props.highlightRoads]);
  const pulsePath = useMemo(() => { const p = new Path2D(); props.pulseRoads?.forEach((id) => { const r = world.byId.get(id); if (r) p.addPath(r.path); }); return p; }, [world, props.pulseRoads]);
  const routeW = useMemo(() => (props.routes ?? []).map((r) => {
    const pts = r.path.map(([lo, la]) => [world.px(lo), world.py(la)] as [number, number]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] || 1, units: r.units };
  }), [world, props.routes]);

  // ---- mutable view state
  const view = useRef({ k: 1, tx: 0, ty: 0, W: 0, H: 0, dpr: 1, fitK: 1 });
  const cam = useRef<null | { from: [number, number, number]; to: [number, number, number]; t0: number; dur: number }>(null);
  const anim = useRef({ colors: null as null | { from: Float32Array; to: Float32Array; t0: number }, routeT0: 0, sig: "" });
  const colors = useRef<Float32Array>(new Float32Array(0));
  const raf = useRef(0), dirty = useRef(true);
  const hover = useRef<{ kind: string; idx: number } | null>(null);

  const targetColors = useCallback((): Float32Array => {
    const p = P.current, n = geo.villages.id.length, out = new Float32Array(n * 3);
    const mode = p.villageMode ?? "neutral";
    for (let i = 0; i < n; i++) {
      let c: number[];
      if (mode === "status" && p.villageStatus) c = hex(STATUS_COLOR[p.villageStatus[i] ?? 0]);
      else if (mode === "heat" && p.villageValues) c = ramp(HEAT_STOPS, Number(p.villageValues[i] ?? 0));
      else if (mode === "time" && p.villageValues) { const v = p.villageValues[i]; c = v == null ? hex("#9c9486") : ramp(TIME_STOPS, Math.min(v, 45) / 45); }
      else c = hex("#2f6b5e");
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
    return out;
  }, [geo]);

  const drawRef = useRef<(now: number) => boolean>(() => false);
  const schedule = useCallback(() => {
    dirty.current = true;
    if (raf.current) return;
    const loop = (now: number) => {
      raf.current = 0;
      if (!dirty.current && !cam.current) return;
      dirty.current = false;
      const again = drawRef.current(now);
      if (again || cam.current) { dirty.current = true; raf.current = requestAnimationFrame(loop); }
    };
    raf.current = requestAnimationFrame(loop);
  }, []);
  const setCam = (k: number, tx: number, ty: number) => { const v = view.current; v.k = k; v.tx = tx; v.ty = ty; dirty.current = true; };
  const fit = useCallback((animate = false) => {
    const v = view.current; if (!v.W) return;
    const [x0, y0, x1, y1] = world.bounds, w = x1 - x0, h = y1 - y0;
    const k = Math.min((v.W - 2 * padding) / w, (v.H - 2 * padding) / h);
    const tx = v.W / 2 - ((x0 + x1) / 2) * k, ty = v.H / 2 - ((y0 + y1) / 2) * k;
    v.fitK = k;
    if (animate) cam.current = { from: [v.k, v.tx, v.ty], to: [k, tx, ty], t0: performance.now(), dur: 700 }; else setCam(k, tx, ty);
    schedule();
  }, [world, padding, schedule]);
  const focusOn = useCallback((lon: number, lat: number, zoom = 6) => {
    const v = view.current, x = world.px(lon), y = world.py(lat), k = v.fitK * zoom;
    cam.current = { from: [v.k, v.tx, v.ty], to: [k, v.W / 2 - x * k, v.H / 2 - y * k], t0: performance.now(), dur: 900 };
    schedule();
  }, [world, schedule]);
  const zoomAt = (f: number, sx: number, sy: number) => {
    const v = view.current, k = Math.min(Math.max(v.k * f, v.fitK * 0.85), v.fitK * 80), r = k / v.k;
    setCam(k, sx - (sx - v.tx) * r, sy - (sy - v.ty) * r); schedule();
  };
  useImperativeHandle(ref, () => ({ fit: () => fit(true), zoomBy: (f) => zoomAt(f, view.current.W / 2, view.current.H / 2), focus: focusOn }), [fit, focusOn]);

  // ---- drawing
  const draw = useCallback((now: number) => {
    const c = canvas.current; if (!c) return false;
    const ctx = c.getContext("2d"); if (!ctx) return false;
    const p = P.current, v = view.current;
    let busy = false;
    if (cam.current) {
      const a = cam.current, t = Math.min((now - a.t0) / a.dur, 1), e = 1 - Math.pow(1 - t, 3);
      v.k = a.from[0] + (a.to[0] - a.from[0]) * e; v.tx = a.from[1] + (a.to[1] - a.from[1]) * e; v.ty = a.from[2] + (a.to[2] - a.from[2]) * e;
      if (t >= 1) cam.current = null; else busy = true;
    }
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.clearRect(0, 0, v.W, v.H);
    if (p.bg) { ctx.fillStyle = p.bg; ctx.fillRect(0, 0, v.W, v.H); }
    const L = { rivers: true, roads: true, villages: true, facilities: true, routes: true, hubs: true, ...p.layers };
    const k = v.k, zs = Math.min(Math.max(Math.pow(k / v.fitK, 0.45), 0.8), 2.6);
    ctx.save(); ctx.translate(v.tx, v.ty); ctx.scale(k, k);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.fillStyle = "rgba(225,216,196,0.42)"; ctx.fill(world.hullPath);
    ctx.strokeStyle = "rgba(20,17,15,0.28)"; ctx.lineWidth = 1 / k; ctx.setLineDash([4 / k, 3 / k]); ctx.stroke(world.hullPath); ctx.setLineDash([]);
    if (L.rivers) { ctx.strokeStyle = "rgba(29,78,137,0.42)"; for (const r of world.rivers) { ctx.lineWidth = (r.k === "river" ? 2.2 : 1.0) / k * zs; ctx.stroke(r.p); } }
    if (L.roads) {
      ctx.strokeStyle = "rgba(20,17,15,0.5)";
      for (const [cat, path] of world.byCat) { ctx.lineWidth = ((ROAD_W[cat] ?? 0.6) * 1.3 / k) * zs; ctx.stroke(path); }
      if (p.highlightRoads?.size) { ctx.strokeStyle = p.highlightColor ?? FLOOD; ctx.lineWidth = (3.2 / k) * zs; ctx.stroke(hiPath); }
      ctx.strokeStyle = CUT; ctx.lineWidth = (1.9 / k) * zs; ctx.stroke(cutPath);
      if (p.pulseRoads?.size) {
        const ph = (Math.sin(now / 260) + 1) / 2; ctx.strokeStyle = `rgba(29,78,137,${0.35 + 0.65 * ph})`; ctx.lineWidth = ((3 + 2 * ph) / k) * zs; ctx.stroke(pulsePath); busy = true;
      }
      if (hover.current?.kind === "road") { const r = world.roads[hover.current.idx]; if (r) { ctx.strokeStyle = INK; ctx.lineWidth = (3 / k) * zs; ctx.stroke(r.path); } }
    }
    ctx.restore();

    // routes (screen space for crisp widths)
    if (L.routes && p.routesOn !== false && routeW.length) {
      const t = ((now - anim.current.routeT0) / 1400);
      const prog = Math.min(t, 1), e = 1 - Math.pow(1 - prog, 3);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? PAPER : FLOOD; ctx.lineWidth = pass === 0 ? 4.6 : 2.2;
        for (const r of routeW) {
          const lim = r.len * e; ctx.beginPath();
          for (let i = 0; i < r.pts.length; i++) {
            if (r.cum[i] > lim) { const j = i - 1; if (j >= 0) { const f = (lim - r.cum[j]) / ((r.cum[i] - r.cum[j]) || 1); ctx.lineTo(v.tx + (r.pts[j][0] + (r.pts[i][0] - r.pts[j][0]) * f) * k, v.ty + (r.pts[j][1] + (r.pts[i][1] - r.pts[j][1]) * f) * k); } break; }
            const X = v.tx + r.pts[i][0] * k, Y = v.ty + r.pts[i][1] * k; i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
          }
          ctx.stroke();
        }
      }
      if (prog >= 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {      // trucks
        ctx.fillStyle = INK;
        routeW.forEach((r, i) => {
          const f = ((now / 5200) + i * 0.173) % 1, d = f * r.len; let j = 1; while (j < r.cum.length - 1 && r.cum[j] < d) j++;
          const a = r.pts[j - 1], b = r.pts[j], u = (d - r.cum[j - 1]) / ((r.cum[j] - r.cum[j - 1]) || 1);
          ctx.beginPath(); ctx.arc(v.tx + (a[0] + (b[0] - a[0]) * u) * k, v.ty + (a[1] + (b[1] - a[1]) * u) * k, 3.2, 0, 7); ctx.fill();
        });
        busy = true;
      } else if (prog < 1) busy = true;
    }

    // villages
    if (L.villages) {
      let mix = 1;
      const A = anim.current.colors;
      if (A) { mix = Math.min((now - A.t0) / 650, 1); mix = 1 - Math.pow(1 - mix, 3); }
      const cc = colors.current, n = world.vx.length;
      for (let i = 0; i < n; i++) {
        let r = cc[i * 3], g = cc[i * 3 + 1], b = cc[i * 3 + 2];
        if (A && mix < 1) { r = A.from[i * 3] + (A.to[i * 3] - A.from[i * 3]) * mix; g = A.from[i * 3 + 1] + (A.to[i * 3 + 1] - A.from[i * 3 + 1]) * mix; b = A.from[i * 3 + 2] + (A.to[i * 3 + 2] - A.from[i * 3 + 2]) * mix; }
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},0.82)`;
        ctx.beginPath(); ctx.arc(v.tx + world.vx[i] * k, v.ty + world.vy[i] * k, world.vr[i] * zs * 0.8, 0, 6.2832); ctx.fill();
      }
      if (A && mix >= 1) anim.current.colors = null; else if (A) busy = true;
      if (hover.current?.kind === "village") { const i = hover.current.idx; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(v.tx + world.vx[i] * k, v.ty + world.vy[i] * k, world.vr[i] * zs * 0.8 + 2.5, 0, 6.2832); ctx.stroke(); }
    }

    // facilities
    if (L.facilities) {
      const s = 5.2 * Math.min(zs, 1.6);
      geo.facilities.id.forEach((id, i) => {
        const X = v.tx + world.fx[i] * k, Y = v.ty + world.fy[i] * k, out = p.facilityOut?.has(id), got = p.facilityDeliver?.get(id);
        if (got) { ctx.fillStyle = "rgba(29,78,137,0.16)"; ctx.beginPath(); ctx.arc(X, Y, s * 2.4, 0, 6.2832); ctx.fill(); }
        if (out) { ctx.strokeStyle = CUT; ctx.lineWidth = 1.8; ctx.strokeRect(X - s * 1.15, Y - s * 1.15, s * 2.3, s * 2.3); ctx.beginPath(); ctx.moveTo(X - s, Y - s); ctx.lineTo(X + s, Y + s); ctx.moveTo(X + s, Y - s); ctx.lineTo(X - s, Y + s); ctx.stroke(); }
        else { ctx.fillStyle = got ? FLOOD : INK; ctx.fillRect(X - s, Y - s, s * 2, s * 2); ctx.strokeStyle = PAPER; ctx.lineWidth = 1; ctx.strokeRect(X - s, Y - s, s * 2, s * 2); }
      });
      if (hover.current?.kind === "facility") { const i = hover.current.idx; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(v.tx + world.fx[i] * k - s * 1.7, v.ty + world.fy[i] * k - s * 1.7, s * 3.4, s * 3.4); }
    }

    // hubs and depot
    if (L.hubs) {
      const drawHub = (lon: number, lat: number, label: string, solid: boolean) => {
        const X = v.tx + world.px(lon) * k, Y = v.ty + world.py(lat) * k, r = 9;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = solid ? FLOOD : PAPER; ctx.strokeStyle = solid ? PAPER : FLOOD; ctx.lineWidth = 2; ctx.fillRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4); ctx.strokeRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4); ctx.restore();
        ctx.font = "600 9.5px 'JetBrains Mono Variable', monospace"; ctx.textBaseline = "middle"; ctx.fillStyle = INK;
        const w = ctx.measureText(label).width; ctx.fillStyle = "rgba(244,239,230,0.85)"; ctx.fillRect(X + 12, Y - 8, w + 8, 16); ctx.fillStyle = INK; ctx.fillText(label, X + 16, Y);
      };
      (p.hubs ?? []).forEach((h, i) => drawHub(h.lon, h.lat, p.hubs!.length > 1 ? `HUB ${i + 1}` : "DEPOT", true));
      if (p.depot) drawHub(geo.depot.lon, geo.depot.lat, "SILCHAR", false);
    }
    return busy || !!anim.current.colors;
  }, [world, geo, cutPath, hiPath, pulsePath, routeW]);

  drawRef.current = draw;
  useEffect(() => { schedule(); }, [draw, schedule]);

  // redraw whenever scene props change; animate village colours and routes
  useEffect(() => {
    const next = targetColors();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (colors.current.length === next.length && !reduced) anim.current.colors = { from: colors.current.slice(), to: next, t0: performance.now() };
    colors.current = next;
    schedule();
  }, [props.villageMode, props.villageStatus, props.villageValues, targetColors, schedule]);
  useEffect(() => { anim.current.routeT0 = performance.now(); schedule(); }, [props.routes, props.routesOn]);
  useEffect(() => { schedule(); }, [draw, props.layers, props.facilityOut, props.facilityDeliver, props.hubs, props.depot, props.highlightRoads, props.pulseRoads, props.cutReveal]);
  useEffect(() => { if (props.focusTarget) focusOn(props.focusTarget.lon, props.focusTarget.lat, props.focusTarget.zoom); }, [props.focusTarget]);
  useEffect(() => { fit(false); }, [props.fitKey, world]);

  // ---- size
  useEffect(() => {
    const el = wrap.current!, c = canvas.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), v = view.current, first = !v.W;
      v.W = r.width; v.H = r.height; v.dpr = dpr; c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      first ? fit(false) : (() => { const [x0, y0, x1, y1] = world.bounds; v.fitK = Math.min((v.W - 2 * padding) / (x1 - x0), (v.H - 2 * padding) / (y1 - y0)); })();
      schedule();
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [fit, schedule, world, padding]);

  // ---- interaction
  const nearest = (sx: number, sy: number, tool: Tool | undefined) => {
    const v = view.current, k = v.k;
    let best: { kind: "village" | "facility" | "road"; idx: number; d: number } | null = null;
    const wx = (sx - v.tx) / k, wy = (sy - v.ty) / k;
    const zs = Math.min(Math.max(Math.pow(k / v.fitK, 0.45), 0.8), 2.6);
    const fs = 5.2 * Math.min(zs, 1.6);
    for (let i = 0; i < world.fx.length; i++) { const d = Math.hypot(v.tx + world.fx[i] * k - sx, v.ty + world.fy[i] * k - sy); if (d < fs * 2.4 && (!best || d < best.d)) best = { kind: "facility", idx: i, d }; }
    if (best) return best;
    if (tool === "cut") {
      const tol = 7 / k; let bd = tol, bi = -1;
      world.roads.forEach((r, ri) => {
        if (wx < r.bbox[0] - tol || wx > r.bbox[2] + tol || wy < r.bbox[1] - tol || wy > r.bbox[3] + tol) return;
        for (const a of r.pts) for (let i = 2; i < a.length; i += 2) {
          const x0 = a[i - 2], y0 = a[i - 1], x1 = a[i], y1 = a[i + 1], dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
          const t = l2 ? Math.min(Math.max(((wx - x0) * dx + (wy - y0) * dy) / l2, 0), 1) : 0, d = Math.hypot(wx - (x0 + t * dx), wy - (y0 + t * dy));
          if (d < bd) { bd = d; bi = ri; }
        }
      });
      if (bi >= 0) return { kind: "road" as const, idx: bi, d: bd * k };
    }
    for (let i = 0; i < world.vx.length; i++) { const d = Math.hypot(v.tx + world.vx[i] * k - sx, v.ty + world.vy[i] * k - sy); if (d < world.vr[i] * zs * 0.8 + 3 && (!best || d < best.d)) best = { kind: "village", idx: i, d }; }
    return best;
  };

  const ptr = useRef(new Map<number, { x: number; y: number }>()), drag = useRef({ moved: 0, pinch: 0 });
  const onDown = (e: React.PointerEvent) => {
    if (!props.interactive) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const r = wrap.current!.getBoundingClientRect(); ptr.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    drag.current.moved = 0; drag.current.pinch = 0; setGrab(true); cam.current = null;
  };
  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, v = view.current;
    if (ptr.current.has(e.pointerId)) {
      const prev = ptr.current.get(e.pointerId)!; ptr.current.set(e.pointerId, { x, y });
      if (ptr.current.size === 2) {
        const [a, b] = [...ptr.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (drag.current.pinch) zoomAt(d / drag.current.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); drag.current.pinch = d; drag.current.moved += 10;
      } else { drag.current.moved += Math.abs(x - prev.x) + Math.abs(y - prev.y); setCam(v.k, v.tx + x - prev.x, v.ty + y - prev.y); schedule(); }
      return;
    }
    if (!props.interactive) return;
    const h = nearest(x, y, props.tool);
    const key = h ? `${h.kind}:${h.idx}` : "";
    if (key !== (hover.current ? `${hover.current.kind}:${hover.current.idx}` : "")) { hover.current = h ? { kind: h.kind, idx: h.idx } : null; schedule(); }
    setTip(h && props.tip ? { x, y, kind: h.kind, idx: h.idx } : null);
  };
  const onUp = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const was = ptr.current.delete(e.pointerId); setGrab(false);
    if (!was || !props.interactive || drag.current.moved > 5 || ptr.current.size) return;
    const tool = props.tool, h = nearest(x, y, tool);
    if (tool === "cut" && h?.kind === "road") props.onRoad?.(world.roads[h.idx].id);
    else if ((tool === "out" || tool === "pan") && h?.kind === "facility") props.onFacility?.(geo.facilities.id[h.idx]);
    else if (tool === "hub") { const [lon, lat] = world.inv((x - view.current.tx) / view.current.k, (y - view.current.ty) / view.current.k); props.onPoint?.(lon, lat); }
  };
  useEffect(() => {
    const el = wrap.current!;
    const onWheel = (e: WheelEvent) => {
      if (!P.current.interactive) return;
      e.preventDefault(); cam.current = null;
      const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const cursor = !props.interactive ? "default" : grab ? "grabbing" : props.tool === "cut" ? "crosshair" : props.tool === "hub" ? "copy" : hover.current ? "pointer" : "grab";
  return (
    <div ref={wrap} className={`map ${className ?? ""}`} style={{ position: "relative", width: "100%", height: "100%", touchAction: props.interactive ? "none" : "auto" }}>
      <canvas ref={canvas} style={{ width: "100%", height: "100%", cursor }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerLeave={() => { hover.current = null; setTip(null); schedule(); }} />
      {props.interactive && controls && (
        <div className="map__ctl">
          <button aria-label="Zoom in" onClick={() => zoomAt(1.6, view.current.W / 2, view.current.H / 2)}>+</button>
          <button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.6, view.current.W / 2, view.current.H / 2)}>{"−"}</button>
          <button aria-label="Fit to view" onClick={() => fit(true)}>{"⌖"}</button>
        </div>
      )}
      {tip && props.tip && (
        <div className="map__tip" style={{ left: Math.min(tip.x + 14, (wrap.current?.clientWidth ?? 400) - 230), top: Math.max(tip.y - 10, 6) }}>{props.tip(tip.kind, tip.idx)}</div>
      )}
    </div>
  );
});
