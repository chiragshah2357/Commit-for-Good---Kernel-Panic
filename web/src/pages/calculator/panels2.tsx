import { line as d3line, max, min, scaleBand, scaleLinear } from "d3";
import { useMemo, useState } from "react";
import { AxisBottom, AxisLeft, Chart, Tip, useTip } from "../../components/charts/kit";
import { Counter } from "../../components/ui";
import { C, SEV_COLOR } from "../../lib/colors";
import { fmt, pct } from "../../lib/format";
import { EnsembleResult, Geometry, POLICIES, POLICY_COLOR, POLICY_LABEL, ParetoResult, Policy, RepairResult, SimResult, UncertaintyResult } from "../../lib/types";
import { Async } from "./hooks";
import { BAND } from "./panels1";
import { useCalc } from "./store";

const Wait = ({ what }: { what: string }) => <div className="wait"><i />{what}</div>;
const Err = ({ e }: { e: string }) => <div className="wait wait--err">{e}</div>;

/* =============================== METHODS =============================== */
function ThisFlood({ sim }: { sim: SimResult }) {
  const sel = sim.chosen.policy;
  const rows = POLICIES.map((p) => ({ p, ...sim.policies[p] }));
  const top = max(rows, (r) => r.total_unmet_units)! * 1.12;
  return (
    <div className="card">
      <div className="card__h"><h4>This flood: unmet demand by method</h4><span className="mono card__s">units over the horizon</span></div>
      <Chart height={232} label="Unmet demand by method on this flood" margin={{ t: 6, r: 96, b: 30, l: 150 }}>
        {(w, h) => {
          const y = scaleBand<string>().domain(POLICIES).range([0, h]).padding(0.28), x = scaleLinear().domain([0, top]).range([0, w]);
          return (
            <>
              <AxisBottom scale={x} h={h} ticks={5} format={(v) => fmt(v)} />
              {rows.map((r) => (
                <g key={r.p} transform={`translate(0,${y(r.p)})`} opacity={r.p === sel ? 1 : 0.78}>
                  <text x={-10} y={y.bandwidth() / 2} dy="0.32em" textAnchor="end" style={{ fill: C.ink, fontFamily: "var(--font-body)", fontSize: 12, fontWeight: r.p === sel ? 700 : 400 }}>{POLICY_LABEL[r.p]}</text>
                  <rect width={x(r.unmet_units)} height={y.bandwidth()} fill={POLICY_COLOR[r.p]} />
                  <rect x={x(r.unmet_units)} width={x(r.cut_off_units)} height={y.bandwidth()} fill={C.cut} opacity={0.28} />
                  <text x={x(r.total_unmet_units) + 8} y={y.bandwidth() / 2} dy="0.32em" className="lbl">{fmt(r.unmet_units)}</text>
                  <text x={w + 8} y={y.bandwidth() / 2} dy="0.32em" style={{ fill: BAND(r.index.value).c, fontWeight: 600 }}>RI {r.index.value.toFixed(0)}</text>
                </g>
              ))}
            </>
          );
        }}
      </Chart>
      <p className="card__note"><i className="dot" style={{ background: C.cut, opacity: 0.4 }} />Pale red is demand inside cut-off villages, the same for every method. The label is unmet demand at facilities; RI is the Resilience Index. Informed nearest-first versus blind: <b className="mono">{fmt(sim.policies.nearest_first.unmet_units - sim.policies.nearest_first_post.unmet_units)}</b> units, from information alone.</p>
    </div>
  );
}

function EnsembleCard({ ens, sel }: { ens: EnsembleResult; sel: Policy }) {
  const P = ens.policies;
  const top = max(POLICIES, (p) => P[p].total_unmet_hi)! * 1.08;
  const lo = min(POLICIES, (p) => P[p].total_unmet_lo)! * 0.9;
  const { tip, show, hide } = useTip<Policy>();
  return (
    <div className="card card--wide">
      <div className="card__h"><h4>Across all {ens.n} generated floods: mean, 95% CI and worst-10% average</h4><span className="mono card__s">{ens.ms} ms</span></div>
      <Chart height={250} label="Mean unmet demand with bootstrap confidence interval and CVaR for each method over 60 floods" margin={{ t: 8, r: 24, b: 38, l: 150 }}>
        {(w, h) => {
          const y = scaleBand<string>().domain(POLICIES).range([0, h]).padding(0.34), x = scaleLinear().domain([lo, top]).nice().range([0, w]);
          return (
            <>
              <AxisBottom scale={x} h={h} ticks={6} format={(v) => fmt(v)} label="Total unmet demand incl. cut-off villages (units)" />
              {POLICIES.map((p) => {
                const r = P[p], cy = y(p)! + y.bandwidth() / 2;
                return (
                  <g key={p} onMouseMove={(e) => show(e, p)} onMouseLeave={hide} opacity={p === sel ? 1 : 0.8}>
                    <text x={-10} y={cy} dy="0.32em" textAnchor="end" style={{ fill: C.ink, fontFamily: "var(--font-body)", fontSize: 12, fontWeight: p === sel ? 700 : 400 }}>{POLICY_LABEL[p]}</text>
                    <line x1={x(r.total_unmet_lo)} x2={x(r.total_unmet_hi)} y1={cy} y2={cy} stroke={POLICY_COLOR[p]} strokeWidth={5} strokeLinecap="butt" opacity={0.45} />
                    <circle cx={x(r.total_unmet_mean)} cy={cy} r={6.5} fill={POLICY_COLOR[p]} stroke={C.paper} strokeWidth={1.5} />
                    <path d={`M${x(r.cvar10_total_unmet)},${cy - 7}l6,7l-6,7l-6,-7z`} fill={C.paper} stroke={C.ink} strokeWidth={1.5} />
                    <rect x={0} y={y(p)} width={w} height={y.bandwidth()} fill="transparent" />
                  </g>
                );
              })}
            </>
          );
        }}
      </Chart>
      <p className="card__note"><i className="dot" style={{ background: C.ink3 }} />mean with 95% bootstrap CI (bar) <svg width="12" height="12" style={{ verticalAlign: -2, margin: "0 4px 0 12px" }}><path d="M6,0l6,6l-6,6l-6,-6z" fill={C.paper} stroke={C.ink} strokeWidth="1.5" /></svg>CVaR 10%: mean of the 6 worst floods. Hover a row for numbers.</p>
      <Tip tip={tip}>{tip && <><b>{POLICY_LABEL[tip.d]}</b><br />mean {fmt(P[tip.d].total_unmet_mean)}<br />95% CI {fmt(P[tip.d].total_unmet_lo)} to {fmt(P[tip.d].total_unmet_hi)}<br />worst-10% avg {fmt(P[tip.d].cvar10_total_unmet)}<br />worst flood {fmt(P[tip.d].worst_total_unmet)}<br />mean RI {P[tip.d].index_mean.toFixed(1)}</>}</Tip>
    </div>
  );
}

function PairedCard({ ens }: { ens: EnsembleResult }) {
  const sel = ens.policy;
  return (
    <div className="card card--wide">
      <div className="card__h"><h4>{POLICY_LABEL[sel]} compared with each alternative</h4><span className="mono card__s">paired over {ens.n} floods, unmet at facilities</span></div>
      <div className="tbl-wrap"><table className="tbl tbl--sm">
        <thead><tr><th>Alternative</th><th className="r">Mean difference</th><th className="r">95% CI</th><th className="r">Better in</th><th className="r">Tied</th><th className="r">Wilcoxon p</th></tr></thead>
        <tbody>{ens.paired.map((r) => <tr key={r.reference}><td>{POLICY_LABEL[r.reference]}</td><td className="r"><b>{fmt(r.mean_diff)}</b></td><td className="r">[{fmt(r.ci_low)}, {fmt(r.ci_high)}]</td><td className="r">{pct(r.win_rate)}</td><td className="r">{pct(r.tie_rate)}</td><td className="r">{r.wilcoxon_p == null ? "all ties" : Number(r.wilcoxon_p).toExponential(1)}</td></tr>)}</tbody>
      </table></div>
      <p className="card__note">Negative differences mean the selected method leaves less unmet. A tie in every flood (no p-value) means the two methods choose the same plan on this set-up.</p>
    </div>
  );
}

function SeverityCard({ ens }: { ens: EnsembleResult }) {
  const sev = ["mild", "moderate", "severe"];
  const top = max(POLICIES, (p) => max(sev, (s) => ens.by_severity[p][s])!)! * 1.1;
  return (
    <div className="card">
      <div className="card__h"><h4>By severity</h4><span className="mono card__s">mean total unmet</span></div>
      <Chart height={230} label="Mean total unmet by severity and method" margin={{ t: 8, r: 8, b: 32, l: 52 }}>
        {(w, h) => {
          const x = scaleBand<string>().domain(sev).range([0, w]).padding(0.2), sub = scaleBand<string>().domain(POLICIES).range([0, x.bandwidth()]).padding(0.06), y = scaleLinear().domain([0, top]).range([h, 0]);
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={4} format={(v) => fmt(v)} />
              <AxisBottom scale={x} h={h} />
              {sev.map((s) => POLICIES.map((p) => <rect key={s + p} x={x(s)! + sub(p)!} y={y(ens.by_severity[p][s])} width={sub.bandwidth()} height={h - y(ens.by_severity[p][s])} fill={POLICY_COLOR[p]} />))}
            </>
          );
        }}
      </Chart>
    </div>
  );
}

export function Methods({ sim, ens }: { sim: SimResult; ens: Async<EnsembleResult> }) {
  return (
    <div className="pan">
      <ThisFlood sim={sim} />
      {ens.data ? <><EnsembleCard ens={ens.data} sel={sim.chosen.policy} /><SeverityCard ens={ens.data} /><PairedCard ens={ens.data} /></> : ens.error ? <Err e={ens.error} /> : <div className="card card--wide"><Wait what="Replaying this set-up on all 60 generated floods…" /></div>}
    </div>
  );
}

/* =============================== DELIVERY =============================== */
export function Delivery({ sim }: { sim: SimResult }) {
  const s = useCalc();
  const ch = sim.policies[sim.chosen.policy], sch = sim.chosen.schedule, fac = sim.chosen.facilities;
  const rows = useMemo(() => fac.filter((f) => f.deliver > 0).sort((a, b) => b.deliver - a.deliver), [fac]);
  const [all, setAll] = useState(false);
  const hubCol = ["#1d4e89", "#5e8c6a", "#c2652b", "#7a8ca3", "#8a5a0f", "#4a443b"];
  const { tip, show, hide } = useTip<(typeof sch.trips)[0]>();
  const trucks = Math.max(sch.loads.length, 1);
  return (
    <div className="pan">
      <div className="card card--wide">
        <div className="card__h"><h4>The plan: {POLICY_LABEL[sim.chosen.policy].toLowerCase()}</h4><label className="chk"><input type="checkbox" checked={s.showRoutes} onChange={(e) => s.set({ showRoutes: e.target.checked })} />show routes on the map</label></div>
        <div className="mini">
          <div><span className="eyebrow">Trips</span><b className="display"><Counter value={ch.visits} live duration={0.5} /></b></div>
          <div><span className="eyebrow">Units delivered</span><b className="display"><Counter value={ch.delivered} live duration={0.6} /></b></div>
          <div><span className="eyebrow">Truck-hours used</span><b className="display"><Counter value={ch.truck_hours} decimals={0} live duration={0.6} /><em> / {fmt(ch.truck_hour_budget)}</em></b></div>
          <div><span className="eyebrow">Wasted deliveries</span><b className="display">{pct(ch.waste_share, 0)}</b></div>
          <div><span className="eyebrow">Facilities unreachable</span><b className="display">{ch.facilities_unreachable}</b></div>
        </div>
        {rows.length === 0 ? <p className="card__note">No delivery is planned: either nothing is short at a reachable facility, or no working facility can be reached from a hub on the damaged network.</p> : (
          <div className="tbl-wrap" style={{ maxHeight: all ? 520 : undefined, overflow: "auto" }}><table className="tbl tbl--sm">
            <thead><tr><th>Facility</th><th className="r">Hub</th><th className="r">Minutes from hub</th><th className="r">Trip hours</th><th className="r">Shortfall</th><th className="r">Deliver</th></tr></thead>
            <tbody>{(all ? rows : rows.slice(0, 10)).map((r) => <tr key={r.id}><td>{r.name}</td><td className="r"><i className="dot" style={{ background: hubCol[r.hub % 6] }} />{r.hub + 1}</td><td className="r">{r.depot_min?.toFixed(0)}</td><td className="r">{r.depot_min != null ? (2 * r.depot_min / 60 + 0.5).toFixed(1) : "–"}</td><td className="r">{fmt(r.shortfall)}</td><td className="r"><b>{fmt(r.deliver)}</b></td></tr>)}</tbody>
          </table></div>
        )}
        {rows.length > 10 && <button className="linkbtn" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? "show top 10" : `show all ${rows.length} deliveries`}</button>}
      </div>
      {sch.trips.length > 0 && (
        <div className="card card--wide">
          <div className="card__h"><h4>Truck schedule</h4><span className="mono card__s">working hours over {sch.days} days · {sch.day_hours} h a day</span></div>
          <Chart height={Math.max(trucks * 30 + 60, 130)} label="Truck schedule as a Gantt chart" margin={{ t: 8, r: 14, b: 36, l: 64 }}>
            {(w, h) => {
              const x = scaleLinear().domain([0, sch.capacity_hours]).range([0, w]);
              const y = scaleBand<string>().domain(Array.from({ length: trucks }, (_, i) => String(i + 1))).range([0, h]).padding(0.22);
              return (
                <>
                  {Array.from({ length: sch.days + 1 }, (_, d) => <g key={d}><line x1={x(d * sch.day_hours)} x2={x(d * sch.day_hours)} y1={0} y2={h} stroke={C.rule2} strokeDasharray="3 3" />{d < sch.days && <text x={x(d * sch.day_hours) + 4} y={h + 28} style={{ fill: C.ink3 }}>day {d + 1}</text>}</g>)}
                  <AxisBottom scale={x} h={h} ticks={10} format={(v) => `${v}h`} />
                  {Array.from({ length: trucks }, (_, i) => <text key={i} x={-10} y={y(String(i + 1))! + y.bandwidth() / 2} dy="0.32em" textAnchor="end">truck {i + 1}</text>)}
                  {sch.trips.map((t) => <rect key={t.facility_id} x={x(t.start)} y={y(String(t.truck))} width={Math.max(x(t.end) - x(t.start) - 1.5, 2)} height={y.bandwidth()} fill={hubCol[t.hub % 6]} opacity={0.88} onMouseMove={(e) => show(e, t)} onMouseLeave={hide} />)}
                </>
              );
            }}
          </Chart>
          <p className="card__note">One feasible packing (longest trip first) of the dedicated trips. The optimiser constrains total truck-hours rather than each truck's day, so this shows the plan can be run{sch.overflow_trips ? <>, but <b>{sch.overflow_trips}</b> trip(s) overrun the window when packed this way</> : <> within the {sch.capacity_hours} h per truck window</>}. Colours are the hubs that load each trip.</p>
          <Tip tip={tip}>{tip && <><b>{tip.d.name}</b><br />truck {tip.d.truck} · hub {tip.d.hub + 1}<br />{fmt(tip.d.units)} units · {tip.d.hours.toFixed(1)} h<br />hours {tip.d.start.toFixed(1)} to {tip.d.end.toFixed(1)}</>}</Tip>
        </div>
      )}
    </div>
  );
}

/* =============================== PRIORITIES =============================== */
export function Priorities({ sim, geo, repair, onFocus }: { sim: SimResult; geo: Geometry; repair: { data: RepairResult | null; loading: boolean; error: string | null; run: () => void }; onFocus: (lon: number, lat: number) => void }) {
  const idx = useMemo(() => new Map(geo.villages.id.map((id, i) => [id, i])), [geo]);
  const s = useCalc();
  const short = useMemo(() => [...sim.chosen.facilities].filter((f) => f.working && f.unmet > 0.5).sort((a, b) => b.unmet - a.unmet).slice(0, 8), [sim]);
  return (
    <div className="pan">
      <div className="card card--wide">
        <div className="card__h"><h4>Worst-hit villages</h4><span className="mono card__s">cut off first, then by residents</span></div>
        <div className="tbl-wrap"><table className="tbl tbl--sm">
          <thead><tr><th>Village</th><th className="r">Residents</th><th className="r">Before</th><th className="r">After</th><th>Status</th><th /></tr></thead>
          <tbody>{sim.ranking.map((r) => <tr key={r.hab_id}><td>{r.name}</td><td className="r">{fmt(r.population)}</td><td className="r">{r.time_before?.toFixed(0)} min</td><td className="r">{r.time_after == null ? "no route" : `${r.time_after.toFixed(0)} min`}</td><td><span className={`badge badge--${r.status === 2 ? "cut" : "delay"}`}>{r.status === 2 ? "cut off" : "delayed"}</span></td><td className="r"><button className="linkbtn" onClick={() => { const i = idx.get(r.hab_id); if (i != null) onFocus(geo.villages.lon[i], geo.villages.lat[i]); }}>show</button></td></tr>)}</tbody>
        </table></div>
        {sim.ranking.length === 0 && <p className="card__note">No village is cut off or delayed in this flood.</p>}
        <p className="card__note">Treat this list as a screen. With 20% of real roads missing from our data the exact top-10 overlaps only 57% to 80% (Evidence, Fig. R5).</p>
      </div>
      <div className="card card--wide">
        <div className="card__h"><h4>Which road to repair first</h4>
          <button className="btn btn--sm" onClick={repair.run} disabled={repair.loading || sim.scenario.segments_cut === 0}>{repair.loading ? "Searching…" : repair.data ? "Recompute" : "Find roads to repair first"}</button></div>
        {repair.error && <Err e={repair.error} />}
        {repair.data ? (
          <>
            <div className="tbl-wrap"><table className="tbl tbl--sm">
              <thead><tr><th>Road segment</th><th>Cat.</th><th className="r">km</th><th className="r">Residents regain access</th><th className="r">Person-minutes saved</th></tr></thead>
              <tbody>{repair.data.rows.map((r) => <tr key={r.seg_id}><td>{r.road_name}</td><td className="mono">{r.category}</td><td className="r">{r.length_km.toFixed(1)}</td><td className="r"><b>{fmt(r.residents_regained)}</b></td><td className="r">{fmt(r.person_minutes_saved)}</td></tr>)}</tbody>
            </table></div>
            <p className="card__note">Each cut segment is restored alone and the network re-solved. {repair.data.candidates} of {repair.data.cut_segments} cut segments help anyone at all; the rest are dead ends or already bypassed. Restored roads pulse on the map. Of {fmt(repair.data.residents_cut_off)} residents cut off, restoring just the first segment returns {fmt(repair.data.rows[0]?.residents_regained ?? 0)}. ({repair.data.ms} ms)</p>
          </>
        ) : <p className="card__note">Restores each cut road on its own and counts the residents who regain access. Runs in a few seconds.</p>}
        {repair.data && <label className="chk"><input type="checkbox" checked={s.showRepair} onChange={(e) => s.set({ showRepair: e.target.checked })} />highlight on the map</label>}
      </div>
      <div className="card">
        <div className="card__h"><h4>Facilities still short</h4><span className="mono card__s">after this plan</span></div>
        {short.length === 0 ? <p className="card__note">Every working facility is covered.</p> : (
          <div className="tbl-wrap"><table className="tbl tbl--sm"><thead><tr><th>Facility</th><th className="r">Unmet</th></tr></thead><tbody>{short.map((f) => <tr key={f.id}><td>{f.name}{f.depot_min == null && <span className="badge badge--grey">no road route</span>}</td><td className="r">{fmt(f.unmet)}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </div>
  );
}

/* =============================== RISK =============================== */
function Strip({ ens, field, title, domain, fmtv }: { ens: EnsembleResult; field: "total_unmet" | "index"; title: string; domain: [number, number]; fmtv: (v: number) => string }) {
  const sev = ["mild", "moderate", "severe"];
  const { tip, show, hide } = useTip<(typeof ens.scenarios)[0]>();
  return (
    <div className="card">
      <div className="card__h"><h4>{title}</h4><span className="mono card__s">{POLICY_LABEL[ens.policy]}</span></div>
      <Chart height={240} label={title} margin={{ t: 10, r: 10, b: 30, l: 52 }}>
        {(w, h) => {
          const x = scaleBand<string>().domain(sev).range([0, w]).padding(0.2), y = scaleLinear().domain(domain).range([h, 0]);
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} format={fmtv} />
              <AxisBottom scale={x} h={h} />
              {sev.map((s) => {
                const pts = ens.scenarios.filter((r) => r.severity === s), m = pts.reduce((a, r) => a + r[field], 0) / pts.length;
                return (
                  <g key={s}>
                    {pts.map((r, i) => <circle key={r.name} cx={x(s)! + x.bandwidth() / 2 + ((i * 53) % 29 - 14) * (x.bandwidth() / 60)} cy={y(r[field])} r={4} fill={SEV_COLOR[s]} opacity={0.7} onMouseMove={(e) => show(e, r)} onMouseLeave={hide} />)}
                    <line x1={x(s)} x2={x(s)! + x.bandwidth()} y1={y(m)} y2={y(m)} stroke={C.ink} strokeWidth={2} /><text x={x(s)! + x.bandwidth()} y={y(m) - 5} textAnchor="end" className="lbl">{fmtv(m)}</text>
                  </g>
                );
              })}
            </>
          );
        }}
      </Chart>
      <Tip tip={tip}>{tip && <><b>{tip.d.name}</b><br />unmet {fmt(tip.d.total_unmet)} · RI {tip.d.index.toFixed(1)}<br />{pct(tip.d.share_cut_off, 1)} cut off</>}</Tip>
    </div>
  );
}

function ParetoCard({ par, trucks }: { par: ParetoResult; trucks: number }) {
  const r = par.rows;
  return (
    <div className="card card--wide">
      <div className="card__h"><h4>How many trucks are enough?</h4><span className="mono card__s">{POLICY_LABEL[par.policy]} · {par.ms} ms</span></div>
      <Chart height={280} label="Total unmet demand against fleet size" margin={{ t: 14, r: 20, b: 40, l: 58 }}>
        {(w, h) => {
          const x = scaleLinear().domain([1, r[r.length - 1].trucks]).range([8, w - 8]), y = scaleLinear().domain([0, max(r, (d) => Math.max(d.ens_p90, d.total_unmet))! * 1.08]).range([h, 0]);
          const L = (k: "ens_mean" | "ens_p90" | "total_unmet") => d3line<(typeof r)[0]>().x((d) => x(d.trucks)).y((d) => y(d[k]))(r)!;
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} format={(v) => fmt(v)} label="Total unmet (units)" />
              <AxisBottom scale={x} h={h} ticks={r.length} format={(v) => String(v)} label="Trucks" />
              <line x1={x(trucks)} x2={x(trucks)} y1={0} y2={h} stroke={C.ink} strokeWidth={1.5} /><text x={x(trucks) + 5} y={12} className="lbl">you: {trucks}</text>
              <line x1={x(par.knee)} x2={x(par.knee)} y1={0} y2={h} stroke={C.ok} strokeDasharray="4 4" strokeWidth={1.5} /><text x={x(par.knee) + 5} y={h - 8} style={{ fill: C.ok }} className="lbl">more trucks stop helping: {par.knee}</text>
              <path d={L("ens_p90")} fill="none" stroke={C.cut} strokeWidth={1.8} strokeDasharray="5 3" /><path d={L("ens_mean")} fill="none" stroke={C.flood} strokeWidth={2.6} /><path d={L("total_unmet")} fill="none" stroke={C.delay} strokeWidth={2} />
              {r.map((d) => <circle key={d.trucks} cx={x(d.trucks)} cy={y(d.ens_mean)} r={3.4} fill={C.flood} />)}
            </>
          );
        }}
      </Chart>
      <div className="legend"><span><i className="ln" style={{ background: C.flood }} />mean over 60 floods</span><span><i className="ln" style={{ background: C.cut }} />90th percentile flood</span><span><i className="ln" style={{ background: C.delay }} />this flood</span></div>
      <p className="card__note">Rule for the marker: {par.rule}. The fleet is a truck-hour budget (10 h a day for 3 days each), so extra trucks only help while there are reachable shortfalls the budget cannot yet cover.</p>
    </div>
  );
}

function UncertaintyCard({ sim, unc }: { sim: SimResult; unc: { data: UncertaintyResult | null; loading: boolean; error: string | null; run: () => void } }) {
  const s = useCalc();
  const ch = sim.policies[sim.chosen.policy];
  const rows = unc.data ? [
    { l: "Residents cut off", b: unc.data.share_cut_off, pt: sim.access.share_cut_off, f: (v: number) => pct(v, 1) },
    { l: "Total unmet demand (units)", b: unc.data.total_unmet, pt: ch.total_unmet_units, f: (v: number) => fmt(v) },
    { l: "Resilience Index", b: unc.data.index, pt: ch.index.value, f: (v: number) => v.toFixed(1) },
  ] : [];
  return (
    <div className="card card--wide">
      <div className="card__h"><h4>If our road data is incomplete</h4>
        <button className="btn btn--sm" onClick={unc.run} disabled={unc.loading}>{unc.loading ? "Re-running…" : unc.data ? "Recompute" : "Run the band"}</button></div>
      <label className="sl sl--inline"><span className="sl__h"><span>Share of real roads missing from the data</span><b className="mono">{(s.missingShare * 100).toFixed(0)}%</b></span><input type="range" min={0.05} max={0.35} step={0.05} value={s.missingShare} onChange={(e) => s.set({ missingShare: +e.target.value })} style={{ ["--p" as string]: `${((s.missingShare - 0.05) / 0.3) * 100}%` }} /></label>
      {unc.error && <Err e={unc.error} />}
      {unc.data ? (
        <div className="ub">{rows.map((r) => {
          const lo = Math.min(r.b.p05, r.pt) * 0.97, hi = Math.max(r.b.p95, r.pt) * 1.03, p = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
          return (
            <div key={r.l} className="ub__r"><span className="ub__l">{r.l}</span>
              <div className="ub__t"><i className="ub__band" style={{ left: p(r.b.p05), width: `calc(${p(r.b.p95)} - ${p(r.b.p05)})` }} /><i className="ub__med" style={{ left: p(r.b.p50) }} /><i className="ub__pt" style={{ left: p(r.pt) }} title="your answer on the data as it is" /></div>
              <span className="ub__v mono">{r.f(r.b.p05)} to {r.f(r.b.p95)}</span></div>
          );
        })}</div>
      ) : <p className="card__note">Removes a random share of road segments from the network, recomputes this flood and plan {unc.data ? "" : "24 times"}, and shows the 5th to 95th percentile. It answers: how far could these numbers move if the open road data is missing some real roads?</p>}
      {unc.data && <p className="card__note"><i className="dot" style={{ background: C.flood, opacity: 0.4 }} />5th to 95th percentile over {unc.data.reps} reruns with {(unc.data.missing_share * 100).toFixed(0)}% of segments removed at random · tick: median · <i className="dot" style={{ background: C.ink }} />your answer on the data as it is. ({unc.data.ms} ms)</p>}
    </div>
  );
}

export function Risk({ sim, ens, par, unc }: { sim: SimResult; ens: Async<EnsembleResult>; par: Async<ParetoResult>; unc: { data: UncertaintyResult | null; loading: boolean; error: string | null; run: () => void } }) {
  const s = useCalc();
  const e = ens.data;
  const maxU = e ? max(e.scenarios, (r) => r.total_unmet)! * 1.08 : 1;
  return (
    <div className="pan">
      {e ? (
        <>
          <div className="card card--wide risk">
            <div className="risk__c"><span className="eyebrow">Expected total unmet</span><b className="display"><Counter value={e.policies[e.policy].total_unmet_mean} live duration={0.6} /></b><small>mean of {e.n} floods</small></div>
            <div className="risk__c"><span className="eyebrow">Worst 10% of floods</span><b className="display" style={{ color: C.cut }}><Counter value={e.policies[e.policy].cvar10_total_unmet} live duration={0.6} /></b><small>CVaR, the 6 worst floods</small></div>
            <div className="risk__c"><span className="eyebrow">Worst single flood</span><b className="display"><Counter value={e.policies[e.policy].worst_total_unmet} live duration={0.6} /></b><small>units unmet</small></div>
            <div className="risk__c"><span className="eyebrow">Mean Resilience Index</span><b className="display" style={{ color: BAND(e.policies[e.policy].index_mean).c }}><Counter value={e.policies[e.policy].index_mean} decimals={1} live duration={0.6} /></b><small>95% CI {e.policies[e.policy].index_lo.toFixed(1)} to {e.policies[e.policy].index_hi.toFixed(1)}</small></div>
          </div>
          <Strip ens={e} field="total_unmet" title="Unmet demand across the 60 floods" domain={[0, maxU]} fmtv={(v) => fmt(v)} />
          <Strip ens={e} field="index" title="Resilience Index across the 60 floods" domain={[0, 100]} fmtv={(v) => v.toFixed(0)} />
        </>
      ) : ens.error ? <Err e={ens.error} /> : <div className="card card--wide"><Wait what="Replaying this set-up on all 60 generated floods…" /></div>}
      {par.data ? <ParetoCard par={par.data} trucks={s.trucks} /> : par.error ? <Err e={par.error} /> : <div className="card card--wide"><Wait what="Sweeping fleet sizes 1 to 12 over 60 floods…" /></div>}
      <UncertaintyCard sim={sim} unc={unc} />
    </div>
  );
}
