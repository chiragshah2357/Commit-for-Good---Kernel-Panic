import { line as d3line, max, mean, min, scaleBand, scaleLinear, scalePoint } from "d3";
import { useMemo, useState } from "react";
import { Chart, AxisBottom, AxisLeft, Tip, useTip } from "../../components/charts/kit";
import { FigMap } from "../../components/map/FigMap";
import { Legend, Stamp } from "../../components/ui";
import { C, SEV_COLOR } from "../../lib/colors";
import { fmt, pct } from "../../lib/format";
import type { Evidence, Geometry, ScenariosFile } from "../../lib/types";

/* ---------- Fig. 1: the five stages ---------- */
const STAGES = [
  { n: "1", t: "Open-data ingestion", d: "Roads, villages (with population), facilities, rivers, terrain", k: "real" as const },
  { n: "2", t: "Network reconstruction", d: "Split at junctions, snap endpoints within 10 m, travel time by road class", k: "real" as const },
  { n: "3", t: "Flood scenarios", d: "Roads and facilities near rivers removed: 60 scenarios, seed 42", k: "gen" as const },
  { n: "4", t: "Access-loss assessment", d: "Shortest-path time to the nearest working facility, before and after", k: "calc" as const },
  { n: "5", t: "Allocation and explanation", d: "Five methods on a capacity-limited depot stock; ranked plan with reasons", k: "gen" as const },
];
export function Schematic() {
  const [on, setOn] = useState(3);
  return (
    <div className="schem">
      {STAGES.map((s, i) => (
        <div key={s.n} className="schem__row">
          <button className={`schem__box schem__box--${s.k} ${on === i ? "on" : ""}`} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)}>
            <span className="schem__n mono">{s.n}</span>
            <b>{s.t}</b>
            <span>{s.d}</span>
            <Stamp kind={s.k} />
          </button>
          {i < STAGES.length - 1 && <span className="schem__arr" aria-hidden>{"→"}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Fig. 2: the network, and one simulated flood ---------- */
export function MapPair({ geo, sc }: { geo: Geometry; sc: ScenariosFile }) {
  const [sev, setSev] = useState<"mild" | "moderate" | "severe">("severe");
  const [rep, setRep] = useState(11);
  const name = `${sev}_${String(rep).padStart(2, "0")}`;
  const p = sc.presets.find((x) => x.name === name)!;
  const cut = useMemo(() => new Set(p.cut), [p]);
  const out = useMemo(() => new Set(p.out), [p]);
  return (
    <div>
      <div className="mp__ctl">
        <span className="eyebrow">Flood for panel (b)</span>
        {(["mild", "moderate", "severe"] as const).map((s) => <button key={s} className="chip" aria-pressed={sev === s} onClick={() => setSev(s)}>{s}</button>)}
        <label className="mp__rng mono">replicate <input type="range" min={0} max={19} value={rep} onChange={(e) => setRep(+e.target.value)} /> {String(rep).padStart(2, "0")}</label>
      </div>
      <div className="mp">
        <div>
          <div className="mp__t">(a) Reconstructed network <Stamp kind="real" /></div>
          <FigMap geo={geo} height={440} layers={{ routes: false, hubs: false }} />
        </div>
        <div>
          <div className="mp__t">(b) One simulated flood: <b className="mono">{name}</b> <Stamp kind="gen" /></div>
          <FigMap geo={geo} height={440} cut={cut} facilityOut={out} layers={{ routes: false, hubs: false }} />
        </div>
      </div>
      <div className="mp__stats mono">
        <span><b>{pct(p.share_road_cut, 1)}</b> of road length cut</span><span><b>{p.segments_cut}</b> of 1,136 segments</span><span><b>{p.facilities_out}</b> of 87 facilities out of service</span>
        <span className="mp__sev" style={{ color: SEV_COLOR[sev] }}>{sev} · flood height {fmt(p.height_m, 2)} m above river · reach {fmt(p.distance_m)} m</span>
      </div>
      <Legend items={[{ label: "road", color: C.rule2, shape: "ln" }, { label: "road cut by flood", color: C.cut, shape: "ln" }, { label: "village (size ~ population)", color: C.ok, shape: "ci" }, { label: "health facility", color: C.ink }, { label: "facility out of service", color: C.cut }]} />
    </div>
  );
}

/* ---------- Fig. 3a: how we found the snapping tolerance ---------- */
export function SnapRound1({ ev }: { ev: Evidence }) {
  const d = ev.snap_round1;
  return (
    <Chart height={290} label="Share of road segments and residents in the largest connected network, by endpoint snapping tolerance" margin={{ t: 18, r: 18, b: 58, l: 50 }}>
      {(w, h) => {
        const x = scalePoint<number>().domain(d.map((r) => r.snap_m)).range([20, w - 20]).padding(0.1);
        const y = scaleLinear().domain([0, 100]).range([h, 0]);
        const ln = (k: "segments" | "residents") => d3line<(typeof d)[0]>().x((r) => x(r.snap_m)!).y((r) => y(r[k]))(d)!;
        return (
          <>
            <AxisLeft scale={y} w={w} ticks={5} format={(v) => `${v}%`} label="Share (%)" />
            <line x1={x(10)} x2={x(10)} y1={0} y2={h} stroke={C.cut} strokeDasharray="4 4" />
            <text x={x(10)! + 6} y={h - 8} fill={C.cut} style={{ fill: C.cut }}>chosen: 10 m</text>
            <path d={ln("segments")} fill="none" stroke={C.flood} strokeWidth={2.2} />
            <path d={ln("residents")} fill="none" stroke={C.ok} strokeWidth={2.2} strokeDasharray="1 0" />
            {d.map((r) => (
              <g key={r.snap_m}>
                <circle cx={x(r.snap_m)} cy={y(r.segments)} r={4.5} fill={C.flood} /><rect x={x(r.snap_m)! - 4} y={y(r.residents) - 4} width={8} height={8} fill={C.ok} />
              </g>
            ))}
            <text x={x(1)! + 9} y={y(18.7) - 9} className="lbl" style={{ fill: C.flood }}>18.7%</text>
            <text x={x(10)! + 9} y={y(90.4) - 9} className="lbl" style={{ fill: C.flood }}>90.4%</text>
            <text x={x(10)! + 9} y={y(88.0) + 18} className="lbl" style={{ fill: C.ok }}>88.0%</text>
            <g transform={`translate(0,${h})`}>
              <path d={`M0,0H${w}`} stroke={C.rule2} />
              {d.map((r) => <g key={r.snap_m} transform={`translate(${x(r.snap_m)},0)`}><text y={18} textAnchor="middle">{r.snap_m} m</text><text y={32} textAnchor="middle" style={{ fill: C.ink3 }}>({r.components})</text></g>)}
              <text x={w / 2} y={50} textAnchor="middle" style={{ fontWeight: 500 }}>Endpoint snapping tolerance (disconnected components)</text>
            </g>
            <g transform={`translate(${w - 230},${h * 0.34})`}>
              <circle r={4.5} cx={4} cy={0} fill={C.flood} /><text x={16} dy="0.32em">Road segments in largest network</text>
              <rect x={0} y={16} width={8} height={8} fill={C.ok} /><text x={16} y={20} dy="0.32em">Residents within 500 m of it</text>
            </g>
          </>
        );
      }}
    </Chart>
  );
}

/* ---------- Fig. 3b: how much damage the 60 floods do ---------- */
export function Spread({ ev }: { ev: Evidence }) {
  const rows = ev.scenario_summary;
  const sevs = ["mild", "moderate", "severe"] as const;
  const { tip, show, hide } = useTip<{ sev: string; n: number; label: string; mean: number; lo: number; hi: number }>();
  const panel = (key: "share_road_length_cut" | "facilities_out", title: string, fmtv: (v: number) => string, top: number) => (
    <div className="spread__p">
      <div className="mp__t">{title}</div>
      <Chart height={270} label={title} margin={{ t: 14, r: 10, b: 34, l: 44 }}>
        {(w, h) => {
          const x = scaleBand<string>().domain([...sevs]).range([0, w]).padding(0.34);
          const y = scaleLinear().domain([0, top]).range([h, 0]);
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} format={fmtv} />
              <AxisBottom scale={x} h={h} />
              {sevs.map((s) => {
                const v = rows.filter((r) => r.severity === s).map((r) => r[key] as number);
                const m = mean(v)!, lo = min(v)!, hi = max(v)!, cx = x(s)! + x.bandwidth() / 2;
                return (
                  <g key={s} onMouseMove={(e) => show(e, { sev: s, n: v.length, label: title, mean: m, lo, hi })} onMouseLeave={hide}>
                    <rect x={x(s)} y={y(m)} width={x.bandwidth()} height={h - y(m)} fill={SEV_COLOR[s]} opacity={0.82} />
                    <line x1={cx} x2={cx} y1={y(lo)} y2={y(hi)} stroke={C.ink} strokeWidth={1.2} /><line x1={cx - 6} x2={cx + 6} y1={y(lo)} y2={y(lo)} stroke={C.ink} /><line x1={cx - 6} x2={cx + 6} y1={y(hi)} y2={y(hi)} stroke={C.ink} />
                    {v.map((d, i) => <circle key={i} cx={cx + ((i * 37) % 21 - 10) * (x.bandwidth() / 46)} cy={y(d)} r={2.2} fill={C.ink} opacity={0.5} />)}
                    <text x={cx} y={y(hi) - 8} textAnchor="middle" className="lbl">{fmtv(m)}</text>
                  </g>
                );
              })}
            </>
          );
        }}
      </Chart>
    </div>
  );
  return (
    <div className="spread">
      {panel("share_road_length_cut", "Road length cut", (v) => (v <= 1 ? `${(v * 100).toFixed(1)}%` : String(v)), 0.72)}
      {panel("facilities_out", "Facilities out of service (of 87)", (v) => String(Math.round(v * 10) / 10), 28)}
      <Tip tip={tip} w={760}>{tip && <><b>{tip.d.sev}</b> · {tip.d.n} floods<br />mean {tip.d.label.startsWith("Road") ? pct(tip.d.mean, 1) : fmt(tip.d.mean, 1)} · range {tip.d.label.startsWith("Road") ? `${pct(tip.d.lo, 1)} to ${pct(tip.d.hi, 1)}` : `${tip.d.lo} to ${tip.d.hi}`}</>}</Tip>
    </div>
  );
}

export function Table3({ ev }: { ev: Evidence }) {
  const rows = ev.scenario_summary;
  const f = (s: string, k: "share_road_length_cut" | "facilities_out" | "segments_cut") => { const v = rows.filter((r) => r.severity === s).map((r) => r[k] as number); return { mean: mean(v)!, lo: min(v)!, hi: max(v)! }; };
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Severity (20 scenarios each)</th><th className="r">Road length cut, % (min / mean / max)</th><th className="r">Road segments cut (mean of 1,136)</th><th className="r">Facilities out, of 87 (min / mean / max)</th></tr></thead>
        <tbody>
          {(["mild", "moderate", "severe"] as const).map((s) => {
            const a = f(s, "share_road_length_cut"), b = f(s, "segments_cut"), c = f(s, "facilities_out");
            return <tr key={s}><td style={{ textTransform: "capitalize" }}>{s}</td><td className="r">{(a.lo * 100).toFixed(1)} / <b className="mono" style={{ color: C.flood }}>{(a.mean * 100).toFixed(1)}</b> / {(a.hi * 100).toFixed(1)}</td><td className="r">{Math.round(b.mean)}</td><td className="r">{c.lo} / <b className="mono" style={{ color: C.flood }}>{c.mean.toFixed(1)}</b> / {c.hi}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Validation: two before/after statistics from the literature ---------- */
export function Dumbbells() {
  const rows = [
    { label: "Use of public health facilities during floods (char/sapori communities, Assam)", a: 62, b: 38, na: "normal", nb: "flood" },
    { label: "Fever among attendees (same study)", a: 28.4, b: 42.7, na: "normal", nb: "flood" },
  ];
  return (
    <Chart height={170} label="Before and after flood statistics from a conference abstract" margin={{ t: 8, r: 20, b: 28, l: 12 }}>
      {(w, h) => {
        const x = scaleLinear().domain([0, 80]).range([0, w]);
        const y = scaleBand<string>().domain(rows.map((r) => r.label)).range([0, h]).padding(0.45);
        return (
          <>
            <AxisBottom scale={x} h={h} ticks={8} format={(v) => `${v}%`} />
            {rows.map((r) => {
              const cy = y(r.label)! + y.bandwidth() / 2 + 8;
              return (
                <g key={r.label}>
                  <text x={0} y={cy - 22} style={{ fill: C.ink, fontFamily: "var(--font-body)", fontSize: 12 }}>{r.label}</text>
                  <line x1={x(r.a)} x2={x(r.b)} y1={cy} y2={cy} stroke={C.rule2} strokeWidth={3} />
                  <circle cx={x(r.a)} cy={cy} r={7} fill={C.ok} /><circle cx={x(r.b)} cy={cy} r={7} fill={C.cut} />
                  <text x={x(r.a)} y={cy + 4} textAnchor={r.a < r.b ? "end" : "start"} dx={r.a < r.b ? -12 : 12} className="lbl">{r.a}%</text>
                  <text x={x(r.b)} y={cy + 4} textAnchor={r.a < r.b ? "start" : "end"} dx={r.a < r.b ? 12 : -12} className="lbl">{r.b}%</text>
                </g>
              );
            })}
          </>
        );
      }}
    </Chart>
  );
}

/* ---------- Gap: the question each existing product answers ---------- */
export function QuestionLadder() {
  const rows = [
    { q: "Where is the water?", who: "NRSC flood-inundation maps and hazard atlas", gap: "Describes water, not access to care. Rapid-mapping products are preliminary and not ground-verified." },
    { q: "How many people and villages were affected?", who: "ASDMA daily flood reports", gap: "Retrospective counts; no facility-level access measure, no allocation guidance." },
    { q: "Is stock available at district level?", who: "NHM review of availability", gap: "Availability is not delivery: it does not say which villages can be reached." },
    { q: "Can char (river-island) communities get care?", who: "NHM boat clinics", gap: "Units may not run when ferry movement is banned in high water; road-based emergency services stay insufficient." },
    { q: "Who loses care first, and what should be sent where?", who: "No open tool found in our structured search", gap: "This is the question Flood-Ready Access answers.", ours: true },
  ];
  return (
    <div className="ladder">
      {rows.map((r, i) => (
        <div key={i} className={`ladder__r ${r.ours ? "ours" : ""}`}>
          <div className="ladder__q display">{r.q}</div>
          <div className="ladder__w"><span className="eyebrow">{r.ours ? "Our answer" : "Answered by"}</span>{r.who}</div>
          <div className="ladder__g">{r.gap}</div>
        </div>
      ))}
    </div>
  );
}
