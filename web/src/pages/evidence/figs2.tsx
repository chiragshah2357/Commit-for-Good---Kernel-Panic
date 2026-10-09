import { bin, line as d3line, max, scaleBand, scaleLinear, scalePoint } from "d3";
import { useMemo } from "react";
import { AxisBottom, AxisLeft, Chart, Tip, useTip } from "../../components/charts/kit";
import { FigMap } from "../../components/map/FigMap";
import { Legend } from "../../components/ui";
import { C } from "../../lib/colors";
import { fmt, pct } from "../../lib/format";
import type { Evidence, Geometry } from "../../lib/types";

/* L1: cleaning the facility layer */
export function FacilityCleaning({ ev }: { ev: Evidence }) {
  const cats = ev.profile.ingestion.facility_categories_raw as Record<string, number>;
  const human = ev.profile.ingestion.human_health_facilities as number, vet = ev.profile.ingestion.veterinary_removed as number;
  const names = Object.keys(cats);
  return (
    <Chart height={250} label="Facility categories in Cachar before cleaning; medical entries split into human-health and veterinary" margin={{ t: 8, r: 70, b: 34, l: 112 }}>
      {(w, h) => {
        const x = scaleLinear().domain([0, 380]).range([0, w]);
        const y = scaleBand<string>().domain(names).range([0, h]).padding(0.28);
        return (
          <>
            <AxisBottom scale={x} h={h} ticks={6} label="Facilities in Cachar (PMGSY GeoSadak)" />
            {names.map((n) => {
              const medical = n === "Medical";
              return (
                <g key={n} transform={`translate(0,${y(n)})`}>
                  <text x={-10} y={y.bandwidth() / 2} dy="0.32em" textAnchor="end" style={{ fill: C.ink, fontFamily: "var(--font-body)", fontSize: 12, fontWeight: medical ? 650 : 400 }}>{n}</text>
                  {medical ? (
                    <>
                      <rect width={x(human)} height={y.bandwidth()} fill={C.ok} />
                      <rect x={x(human)} width={x(vet)} height={y.bandwidth()} fill={C.cut} />
                      <text x={x(human) / 2} y={y.bandwidth() / 2} dy="0.32em" textAnchor="middle" style={{ fill: "#fff", fontWeight: 600 }}>{human} human-health</text>
                      <text x={x(cats[n]) + 8} y={y.bandwidth() / 2} dy="0.32em" className="lbl" style={{ fill: C.cut }}>{vet} veterinary removed</text>
                    </>
                  ) : (
                    <>
                      <rect width={x(cats[n])} height={y.bandwidth()} fill={C.rule2} />
                      <text x={x(cats[n]) + 8} y={y.bandwidth() / 2} dy="0.32em" className="lbl">{cats[n]}</text>
                    </>
                  )}
                </g>
              );
            })}
          </>
        );
      }}
    </Chart>
  );
}

/* L2: village sizes */
export function VillageSizes({ ev }: { ev: Evidence }) {
  const b = ev.village_bands;
  const { tip, show, hide } = useTip<(typeof b)[0]>();
  return (
    <>
      <Chart height={290} label="Number of villages by population band" margin={{ t: 30, r: 10, b: 40, l: 48 }}>
        {(w, h) => {
          const x = scaleBand<string>().domain(b.map((r) => r.band)).range([0, w]).padding(0.16);
          const y = scaleLinear().domain([0, max(b, (r) => r.villages)! * 1.18]).range([h, 0]);
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} label="Villages" />
              <AxisBottom scale={x} h={h} label="Village size (residents)" />
              {b.map((r) => (
                <g key={r.band} onMouseMove={(e) => show(e, r)} onMouseLeave={hide}>
                  <rect x={x(r.band)} y={y(r.villages)} width={x.bandwidth()} height={h - y(r.villages)} fill={C.ok} />
                  <text x={x(r.band)! + x.bandwidth() / 2} y={y(r.villages) - 17} textAnchor="middle" className="lbl">{r.villages}</text>
                  <text x={x(r.band)! + x.bandwidth() / 2} y={y(r.villages) - 5} textAnchor="middle" style={{ fill: C.ink3 }}>{fmt(r.residents / 1000)}k people</text>
                </g>
              ))}
            </>
          );
        }}
      </Chart>
      <Tip tip={tip}>{tip && <><b>{tip.d.band} residents</b><br />{tip.d.villages} villages hold {fmt(tip.d.residents)} people</>}</Tip>
    </>
  );
}

/* L3: road categories */
export function RoadCategories({ ev }: { ev: Evidence }) {
  const r = ev.road_categories;
  return (
    <Chart height={250} label="Kilometres of road by PMGSY category" margin={{ t: 8, r: 150, b: 34, l: 84 }}>
      {(w, h) => {
        const x = scaleLinear().domain([0, max(r, (d) => d.km)!]).range([0, w]);
        const y = scaleBand<string>().domain(r.map((d) => d.RoadCatego)).range([0, h]).padding(0.25);
        return (
          <>
            <AxisBottom scale={x} h={h} ticks={6} label="Kilometres" format={(v) => fmt(v)} />
            {r.map((d) => (
              <g key={d.RoadCatego} transform={`translate(0,${y(d.RoadCatego)})`}>
                <text x={-10} y={y.bandwidth() / 2} dy="0.32em" textAnchor="end" style={{ fill: C.ink, fontFamily: "var(--font-mono)" }}>{d.RoadCatego}</text>
                <rect width={x(d.km)} height={y.bandwidth()} fill={C.flood2} />
                <text x={x(d.km) + 8} y={y.bandwidth() / 2} dy="0.32em" className="lbl">{fmt(d.km)} km <tspan style={{ fill: C.ink3, fontWeight: 400 }}>({d.segments} seg.)</tspan></text>
              </g>
            ))}
          </>
        );
      }}
    </Chart>
  );
}

/* L4: how far people are from care before any flood */
export function AccessCdf({ ev }: { ev: Evidence }) {
  const d = ev.access_cdf, a = ev.profile.access_before_flood;
  const { tip, show, hide } = useTip<(typeof d)[0]>();
  return (
    <>
      <Chart height={300} label="Share of residents within each travel time of the nearest facility, before any flood" margin={{ t: 20, r: 24, b: 44, l: 52 }}>
        {(w, h) => {
          const x = scaleLinear().domain([0, 90]).range([0, w]);
          const y = scaleLinear().domain([0, 100]).range([h, 0]);
          const ln = d3line<(typeof d)[0]>().x((r) => x(r.minutes)).y((r) => y(r.residents_within_share * 100))(d)!;
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} format={(v) => `${v}%`} label="Residents within reach" />
              <AxisBottom scale={x} h={h} ticks={9} label="Travel time to the nearest facility (minutes)" />
              <rect x={x(30)} y={0} width={w - x(30)} height={h} fill={C.cutSoft} opacity={0.55} />
              <text x={x(30) + 8} y={14} style={{ fill: C.cut }} className="lbl">over 30 min: {fmt(a.residents_over_30_min)} residents</text>
              <path d={ln} fill="none" stroke={C.ok} strokeWidth={2.4} />
              {d.map((r) => (
                <g key={r.minutes} onMouseMove={(e) => show(e, r)} onMouseLeave={hide}>
                  <circle cx={x(r.minutes)} cy={y(r.residents_within_share * 100)} r={4.5} fill={C.ok} />
                  <text x={x(r.minutes)} y={y(r.residents_within_share * 100) + 18} textAnchor="middle" style={{ fill: C.ink2 }}>{Math.round(r.residents_within_share * 100)}%</text>
                </g>
              ))}
              {[{ v: a.median_min, l: "median" }, { v: a.p90_min, l: "90th pct" }].map((m) => (
                <g key={m.l}><line x1={x(m.v)} x2={x(m.v)} y1={0} y2={h} stroke={C.ink} strokeDasharray="3 4" /><text x={x(m.v) + 5} y={h - 8} style={{ fill: C.ink }} className="lbl">{m.l} {m.v.toFixed(0)} min</text></g>
              ))}
            </>
          );
        }}
      </Chart>
      <Tip tip={tip}>{tip && <><b>within {tip.d.minutes} min</b><br />{pct(tip.d.residents_within_share, 1)} of residents</>}</Tip>
    </>
  );
}

/* L5: the road network audit (split at junctions, then snap) */
export function NetworkAudit({ ev }: { ev: Evidence }) {
  const s = ev.snap_mvp;
  return (
    <div className="two">
      <div>
        <div className="mp__t">Share joined into one network</div>
        <Chart height={270} label="Share of segments and residents in the main network by snapping tolerance" margin={{ t: 14, r: 14, b: 44, l: 48 }}>
          {(w, h) => {
            const x = scalePoint<number>().domain(s.map((r) => r.snap_m)).range([14, w - 14]).padding(0.1);
            const y = scaleLinear().domain([0, 100]).range([h, 0]);
            const L = (k: "segments_in_main_share" | "residents_attached_share") => d3line<(typeof s)[0]>().x((r) => x(r.snap_m)!).y((r) => y(r[k] * 100))(s)!;
            return (
              <>
                <AxisLeft scale={y} w={w} ticks={5} format={(v) => `${v}%`} />
                <line x1={x(10)} x2={x(10)} y1={0} y2={h} stroke={C.cut} strokeDasharray="4 4" /><text x={x(10)! + 6} y={h - 8} style={{ fill: C.cut }}>10 m</text>
                <path d={L("segments_in_main_share")} fill="none" stroke={C.flood} strokeWidth={2.2} /><path d={L("residents_attached_share")} fill="none" stroke={C.ok} strokeWidth={2.2} />
                {s.map((r) => <g key={r.snap_m}><circle cx={x(r.snap_m)} cy={y(r.segments_in_main_share * 100)} r={4} fill={C.flood} /><rect x={x(r.snap_m)! - 3.5} y={y(r.residents_attached_share * 100) - 3.5} width={7} height={7} fill={C.ok} /></g>)}
                <text x={x(10)! + 8} y={y(s.find((r) => r.snap_m === 10)!.segments_in_main_share * 100) - 9} className="lbl" style={{ fill: C.flood }}>{pct(s.find((r) => r.snap_m === 10)!.segments_in_main_share, 1)}</text>
                <g className="axis" transform={`translate(0,${h})`}><path d={`M0,0H${w}`} />{s.map((r) => <g key={r.snap_m} transform={`translate(${x(r.snap_m)},0)`}><line y2="5" /><text y="18" textAnchor="middle">{r.snap_m} m</text></g>)}<text x={w / 2} y={36} textAnchor="middle" style={{ fontWeight: 500 }}>Snapping tolerance</text></g>
                <g transform={`translate(${w - 150},${h * 0.62})`}><circle r={4} cx={4} fill={C.flood} /><text x={14} dy="0.32em">road segments</text><rect y={14} width={7} height={7} fill={C.ok} /><text x={14} y={18} dy="0.32em">residents attached</text></g>
              </>
            );
          }}
        </Chart>
      </div>
      <div>
        <div className="mp__t">Fragments left over</div>
        <Chart height={270} label="Number of disconnected components by snapping tolerance" margin={{ t: 22, r: 10, b: 44, l: 48 }}>
          {(w, h) => {
            const x = scaleBand<string>().domain(s.map((r) => String(r.snap_m))).range([0, w]).padding(0.28);
            const y = scaleLinear().domain([0, max(s, (r) => r.components)! * 1.12]).range([h, 0]);
            return (
              <>
                <AxisLeft scale={y} w={w} ticks={5} label="Disconnected pieces" />
                <AxisBottom scale={x} h={h} format={(v) => `${v} m`} label="Snapping tolerance" />
                {s.map((r) => <g key={r.snap_m}><rect x={x(String(r.snap_m))} y={y(r.components)} width={x.bandwidth()} height={h - y(r.components)} fill={r.snap_m === 10 ? C.cut : C.flood2} /><text x={x(String(r.snap_m))! + x.bandwidth() / 2} y={y(r.components) - 6} textAnchor="middle" className="lbl">{r.components}</text></g>)}
              </>
            );
          }}
        </Chart>
      </div>
    </div>
  );
}

/* shared histogram */
function Hist({ values, thresholds, color, xLabel, yLabel, vline, vlabel, fmtX = (v: number) => String(v) }: { values: number[]; thresholds: number[]; color: string; xLabel: string; yLabel: string; vline?: number; vlabel?: string; fmtX?: (v: number) => string }) {
  const bins = useMemo(() => bin().domain([thresholds[0], thresholds[thresholds.length - 1]]).thresholds(thresholds.slice(1, -1))(values), [values, thresholds]);
  const { tip, show, hide } = useTip<(typeof bins)[0]>();
  return (
    <>
      <Chart height={260} label={`${yLabel} by ${xLabel}`} margin={{ t: 16, r: 12, b: 44, l: 48 }}>
        {(w, h) => {
          const x = scaleLinear().domain([thresholds[0], thresholds[thresholds.length - 1]]).range([0, w]);
          const y = scaleLinear().domain([0, max(bins, (b) => b.length)! * 1.12]).nice().range([h, 0]);
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} label={yLabel} />
              <AxisBottom scale={x} h={h} ticks={6} format={fmtX} label={xLabel} />
              {bins.map((b, i) => <rect key={i} x={x(b.x0!) + 1} y={y(b.length)} width={Math.max(x(b.x1!) - x(b.x0!) - 2, 1)} height={h - y(b.length)} fill={color} onMouseMove={(e) => show(e, b)} onMouseLeave={hide} />)}
              {vline != null && <g><line x1={x(vline)} x2={x(vline)} y1={0} y2={h} stroke={C.cut} strokeDasharray="4 4" /><text x={x(vline) + 6} y={12} style={{ fill: C.cut }} className="lbl">{vlabel}</text></g>}
            </>
          );
        }}
      </Chart>
      <Tip tip={tip}>{tip && <><b>{fmtX(tip.d.x0!)} to {fmtX(tip.d.x1!)}</b><br />{tip.d.length} facilities</>}</Tip>
    </>
  );
}

/* L6: how many people a facility serves, and how much stock it holds (generated) */
export function CatchmentsStock({ ev }: { ev: Evidence }) {
  const c = ev.catchments;
  const served = useMemo(() => c.map((r) => r.residents_served / 1000), [c]);
  const cover = useMemo(() => c.map((r) => r.days_of_cover).filter((v): v is number => v != null), [c]);
  return (
    <div className="two">
      <div><div className="mp__t">Residents served per facility (real catchments by travel time)</div><Hist values={served} thresholds={Array.from({ length: 16 }, (_, i) => i * 8)} color={C.ok} xLabel="Residents served (thousands)" yLabel="Facilities" /></div>
      <div><div className="mp__t">Days of stock on hand (generated)</div><Hist values={cover} thresholds={Array.from({ length: 16 }, (_, i) => i * 4)} color={C.delay} xLabel="Days of stock cover" yLabel="Facilities" vline={14} vlabel={`${ev.profile.stock.facilities_under_14_days} of 87 under 14 days`} /></div>
    </div>
  );
}

/* L7: baseline access map */
export function BaselineMap({ geo, ev }: { geo: Geometry; ev: Evidence }) {
  const values = useMemo(() => { const m = new Map(ev.village_baseline.id.map((id, i) => [id, ev.village_baseline.time[i]])); return geo.villages.id.map((id) => m.get(id) ?? null); }, [geo, ev]);
  return (
    <div>
      <FigMap geo={geo} height={560} villageMode="time" villageValues={values} layers={{ routes: false, hubs: false }} />
      <div className="ramp"><span className="mono">0 min</span><i style={{ background: "linear-gradient(to right,#2f6b5e,#8aa05a,#c98a1b,#c0392b)" }} /><span className="mono">45+ min to the nearest facility</span></div>
    </div>
  );
}

/* L8: where preventive action pays most */
export function VulnerabilityMap({ geo, ev }: { geo: Geometry; ev: Evidence }) {
  const values = useMemo(() => { const m = new Map(ev.vulnerability_freq.id.map((id, i) => [id, ev.vulnerability_freq.freq[i]])); return geo.villages.id.map((id) => m.get(id) ?? 0); }, [geo, ev]);
  const crit = useMemo(() => new Set(ev.critical_seg_ids), [ev]);
  return (
    <div>
      <FigMap geo={geo} height={560} villageMode="heat" villageValues={values} highlightRoads={crit} highlightColor={C.ink} layers={{ routes: false, hubs: false }} />
      <div className="ramp"><span className="mono">never cut off</span><i style={{ background: "linear-gradient(to right,#e9dfca,#e3b98a,#c0392b,#6f160d)" }} /><span className="mono">cut off in every one of the 60 floods</span></div>
      <Legend items={[{ label: "the 10 most critical road segments", color: C.ink, shape: "ln" }]} />
    </div>
  );
}

export function VulnTables({ ev }: { ev: Evidence }) {
  return (
    <div className="two two--wide">
      <div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Village</th><th className="r">Residents</th><th className="r">Cut off in</th><th className="r">Expected cut off</th></tr></thead>
          <tbody>{ev.vulnerability_top.slice(0, 8).map((r) => <tr key={r.hab_id}><td>{r.name}</td><td className="r">{fmt(r.population)}</td><td className="r">{pct(r.cut_off_freq)} of floods</td><td className="r"><b>{fmt(r.expected_residents_cut_off)}</b></td></tr>)}</tbody>
        </table></div>
        <p className="tbl-cap"><b>Table A</b> Most vulnerable villages across 60 generated floods (expected residents cut off = residents x share of floods that cut the village off).</p>
      </div>
      <div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Road segment</th><th>Cat.</th><th className="r">km</th><th className="r">Cut off if lost alone</th></tr></thead>
          <tbody>{ev.criticality_top.slice(0, 8).map((r) => <tr key={r.seg_id}><td>{r.road_name}</td><td className="mono">{r.category}</td><td className="r">{r.length_km.toFixed(1)}</td><td className="r"><b>{fmt(r.residents_cut_off)}</b></td></tr>)}</tbody>
        </table></div>
        <p className="tbl-cap"><b>Table B</b> Most critical road segments: residents who lose all access if this one segment alone is removed from the real network.</p>
      </div>
    </div>
  );
}
