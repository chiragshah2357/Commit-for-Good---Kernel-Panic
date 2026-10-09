import { line as d3line, max, scaleBand, scaleLinear } from "d3";
import { useState } from "react";
import { AxisBottom, AxisLeft, Chart, Tip, useTip } from "../../components/charts/kit";
import { Legend } from "../../components/ui";
import { C } from "../../lib/colors";
import { fmt, pct } from "../../lib/format";
import { Evidence, POLICIES, POLICY_COLOR, POLICY_LABEL, Policy } from "../../lib/types";

const SEV = ["mild", "moderate", "severe"] as const;
const SINGLE = "single depot (Silchar centre)", RESILIENT = "single resilient depot", THREE = "three hubs";
const SHORT: Record<Policy, string> = { none: "none", proportional: "prop.", nearest_first: "blind", nearest_first_post: "inform.", access_opt: "optim." };

function FleetPick({ v, set }: { v: number; set: (n: number) => void }) {
  return <div className="mp__ctl"><span className="eyebrow">Trucks</span>{[2, 4, 8].map((n) => <button key={n} className="chip" aria-pressed={v === n} onClick={() => set(n)}>{n}</button>)}</div>;
}

/* R1: unmet demand by method, single depot against three hubs */
export function UnmetByPolicy({ ev }: { ev: Evidence }) {
  const [fleet, setFleet] = useState(2);
  const { tip, show, hide } = useTip<{ pol: Policy; cfg: string; m: number; lo: number; hi: number; sev: string }>();
  const get = (sev: string, cfg: string, pol: Policy) => ev.alloc_stats.find((r) => r.metric === "unmet_units" && r.severity === sev && r.config === cfg && r.fleet === fleet && r.policy === pol);
  const top = max(ev.alloc_stats.filter((r) => r.metric === "unmet_units" && r.fleet === fleet && (r.config === SINGLE || r.config === THREE)), (r) => r.ci_high)! * 1.08;
  return (
    <div>
      <FleetPick v={fleet} set={setFleet} />
      <div className="three">
        {SEV.map((sev, k) => (
          <div key={sev}>
            <div className="mp__t" style={{ textTransform: "capitalize" }}>{sev}</div>
            <Chart height={290} label={`Unmet demand by method, ${sev} floods, ${fleet} trucks`} margin={{ t: 10, r: 6, b: 40, l: k === 0 ? 52 : 12 }}>
              {(w, h) => {
                const x = scaleBand<string>().domain(POLICIES).range([0, w]).padding(0.14);
                const sub = scaleBand<string>().domain([SINGLE, THREE]).range([0, x.bandwidth()]).padding(0.08);
                const y = scaleLinear().domain([0, top]).range([h, 0]);
                return (
                  <>
                    {k === 0 ? <AxisLeft scale={y} w={w} ticks={5} format={(v) => fmt(v)} label="Unmet units (14 days)" /> : <AxisLeft scale={y} w={w} ticks={5} format={() => ""} />}
                    <AxisBottom scale={x} h={h} format={(v: Policy) => SHORT[v]} />
                    {POLICIES.map((pol) => [SINGLE, THREE].map((cfg) => {
                      const r = get(sev, cfg, pol); if (!r) return null;
                      const bx = x(pol)! + sub(cfg)!, bw = sub.bandwidth();
                      return (
                        <g key={pol + cfg} onMouseMove={(e) => show(e, { pol, cfg, m: r.mean, lo: r.ci_low, hi: r.ci_high, sev })} onMouseLeave={hide}>
                          <rect x={bx} y={y(r.mean)} width={bw} height={h - y(r.mean)} fill={cfg === THREE ? C.flood : C.grey} opacity={cfg === THREE ? 0.92 : 0.8} />
                          <line x1={bx + bw / 2} x2={bx + bw / 2} y1={y(r.ci_low)} y2={y(r.ci_high)} stroke={C.ink} strokeWidth={1} /><line x1={bx + bw / 2 - 2.5} x2={bx + bw / 2 + 2.5} y1={y(r.ci_high)} y2={y(r.ci_high)} stroke={C.ink} />
                        </g>
                      );
                    }))}
                  </>
                );
              }}
            </Chart>
          </div>
        ))}
      </div>
      <Legend items={[{ label: "single depot (Silchar centre)", color: C.grey }, { label: "three pre-positioned hubs", color: C.flood }]} />
      <Tip tip={tip}>{tip && <><b>{POLICY_LABEL[tip.d.pol]}</b><br />{tip.d.cfg} · {tip.d.sev}<br />mean {fmt(tip.d.m)} units<br />95% CI {fmt(tip.d.lo)} to {fmt(tip.d.hi)}</>}</Tip>
    </div>
  );
}

/* R2: where the gain comes from */
export function InfoVsOpt({ ev }: { ev: Evidence }) {
  const [fleet, setFleet] = useState(2);
  const g = (sev: string, pol: Policy) => ev.alloc_means.find((r) => r.config === THREE && r.fleet === fleet && r.severity === sev && r.policy === pol).unmet as number;
  const rows = SEV.map((sev) => ({ sev, info: g(sev, "nearest_first") - g(sev, "nearest_first_post"), opt: g(sev, "nearest_first_post") - g(sev, "access_opt"), rest: g(sev, "access_opt"), blind: g(sev, "nearest_first") }));
  const { tip, show, hide } = useTip<{ sev: string; part: string; v: number }>();
  return (
    <div>
      <FleetPick v={fleet} set={setFleet} />
      <Chart height={310} label="Unmet demand of blind nearest-first split into information gain, optimisation gain and what remains" margin={{ t: 16, r: 20, b: 40, l: 60 }}>
        {(w, h) => {
          const x = scaleBand<string>().domain([...SEV]).range([0, w]).padding(0.32);
          const y = scaleLinear().domain([0, max(rows, (r) => r.blind)! * 1.08]).range([h, 0]);
          const parts = [{ k: "rest", c: C.grey, l: "still unmet (unreachable or cut off)" }, { k: "opt", c: C.flood, l: "removed by optimisation" }, { k: "info", c: "#5e8c6a", l: "removed by post-flood information" }] as const;
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} format={(v) => fmt(v)} label="Unmet demand, blind nearest-first (units)" />
              <AxisBottom scale={x} h={h} />
              {rows.map((r) => {
                let acc = 0;
                return (
                  <g key={r.sev}>
                    {parts.map((p) => { const v = Math.max(r[p.k], 0), y0 = y(acc + v), hh = y(acc) - y(acc + v); acc += v; return <rect key={p.k} x={x(r.sev)} y={y0} width={x.bandwidth()} height={hh} fill={p.c} onMouseMove={(e) => show(e, { sev: r.sev, part: p.l, v })} onMouseLeave={hide} />; })}
                    <text x={x(r.sev)! + x.bandwidth() / 2} y={y(r.blind) - 7} textAnchor="middle" className="lbl">{fmt(r.blind)}</text>
                  </g>
                );
              })}
            </>
          );
        }}
      </Chart>
      <Legend items={[{ label: "removed by post-flood information", color: "#5e8c6a" }, { label: "removed by optimisation", color: C.flood }, { label: "still unmet: unreachable or cut off", color: C.grey }]} />
      <Tip tip={tip}>{tip && <><b style={{ textTransform: "capitalize" }}>{tip.d.sev}</b><br />{tip.d.part}: {fmt(tip.d.v)} units</>}</Tip>
    </div>
  );
}

/* R3: pre-positioning stock */
export function HubResilience({ ev }: { ev: Evidence }) {
  const [split, setSplit] = useState<"test" | "train">("test");
  const rows = [SINGLE, RESILIENT, THREE].map((cfg) => ev.hub_resilience.find((r) => r.config === cfg && r.split === split));
  const names = ["single depot\n(Silchar)", "single\nresilient", "three hubs"];
  const colors = [C.grey, C.flood2, C.flood];
  const panel = (key: "mean_facilities_reachable_share" | "share_scenarios_isolated", title: string) => (
    <div>
      <div className="mp__t">{title}</div>
      <Chart height={270} label={title} margin={{ t: 22, r: 10, b: 50, l: 48 }}>
        {(w, h) => {
          const x = scaleBand<string>().domain(names).range([0, w]).padding(0.28);
          const y = scaleLinear().domain([0, 100]).range([h, 0]);
          return (
            <>
              <AxisLeft scale={y} w={w} ticks={5} format={(v) => `${v}%`} />
              <g transform={`translate(0,${h})`}><path d={`M0,0H${w}`} stroke={C.rule2} />{names.map((n) => <text key={n} x={x(n)! + x.bandwidth() / 2} textAnchor="middle" y={18}>{n.split("\n").map((t, i) => <tspan key={i} x={x(n)! + x.bandwidth() / 2} dy={i ? 13 : 0}>{t}</tspan>)}</text>)}</g>
              {rows.map((r, i) => r && <g key={i}><rect x={x(names[i])} y={y(r[key] * 100)} width={x.bandwidth()} height={h - y(r[key] * 100)} fill={colors[i]} /><text x={x(names[i])! + x.bandwidth() / 2} y={y(r[key] * 100) - 7} textAnchor="middle" className="lbl">{Math.round(r[key] * 100)}%</text></g>)}
            </>
          );
        }}
      </Chart>
    </div>
  );
  return (
    <div>
      <div className="mp__ctl"><span className="eyebrow">Floods</span><button className="chip" aria-pressed={split === "test"} onClick={() => setSplit("test")}>30 held-out (test)</button><button className="chip" aria-pressed={split === "train"} onClick={() => setSplit("train")}>30 used to choose hubs (train)</button></div>
      <div className="two">{panel("mean_facilities_reachable_share", "Facilities reachable from a hub")}{panel("share_scenarios_isolated", "Floods leaving under 50% of facilities reachable")}</div>
    </div>
  );
}

/* R4: sensitivity to the assumptions */
export function Sensitivity({ ev }: { ev: Evidence }) {
  const params = [{ k: "depot_mult", t: "Depot stock (x baseline)" }, { k: "horizon", t: "Planning horizon (days)" }, { k: "trucks", t: "Trucks" }, { k: "rate", t: "Demand rate (x baseline)" }];
  return (
    <div>
      <div className="four">
        {params.map((p, k) => {
          const rows = ev.sensitivity.filter((r) => r.param === p.k);
          const xs = [...new Set(rows.map((r) => r.value as number))].sort((a, b) => a - b);
          return (
            <div key={p.k}>
              <div className="mp__t">{p.t}</div>
              <Chart height={250} label={`Mean unmet demand against ${p.t}`} margin={{ t: 10, r: 10, b: 38, l: k === 0 ? 54 : 44 }}>
                {(w, h) => {
                  const x = scaleLinear().domain([xs[0], xs[xs.length - 1]]).range([6, w - 6]);
                  const y = scaleLinear().domain([0, max(rows, (r) => r.unmet_units)! * 1.05]).range([h, 0]);
                  return (
                    <>
                      <AxisLeft scale={y} w={w} ticks={4} format={(v) => fmt(v)} label={k === 0 ? "Mean unmet (units)" : undefined} />
                      <g className="axis" transform={`translate(0,${h})`}><path d={`M0,0H${w}`} />{xs.map((v) => <g key={v} transform={`translate(${x(v)},0)`}><line y2="5" /><text y="17" textAnchor="middle">{v}</text></g>)}</g>
                      {POLICIES.map((pol) => {
                        const pts = xs.map((v) => rows.find((r) => r.value === v && r.policy === pol)).filter(Boolean) as any[];
                        const ln = d3line<any>().x((r) => x(r.value)).y((r) => y(r.unmet_units))(pts)!;
                        return <g key={pol}><path d={ln} fill="none" stroke={POLICY_COLOR[pol]} strokeWidth={pol === "access_opt" ? 2.4 : 1.6} strokeDasharray={pol === "none" ? "4 3" : undefined} />{pts.map((r) => <circle key={r.value} cx={x(r.value)} cy={y(r.unmet_units)} r={2.4} fill={POLICY_COLOR[pol]} />)}</g>;
                      })}
                    </>
                  );
                }}
              </Chart>
            </div>
          );
        })}
      </div>
      <Legend items={POLICIES.map((p) => ({ label: POLICY_LABEL[p], color: POLICY_COLOR[p], shape: "ln" as const }))} />
    </div>
  );
}

/* R5: how fragile are the answers */
export function Robustness({ ev }: { ev: Evidence }) {
  const r = ev.robustness, s = ev.sensitivity_snap, sp = ev.sensitivity_speed;
  return (
    <div>
      <div className="three">
        <div>
          <div className="mp__t">Ranking stability when real roads are missing from our data</div>
          <Chart height={260} label="Overlap of the top-10 worst-hit villages as the share of missing roads rises" margin={{ t: 22, r: 18, b: 44, l: 50 }}>
            {(w, h) => {
              const x = scaleLinear().domain([0, 25]).range([8, w - 8]), y = scaleLinear().domain([0, 100]).range([h, 0]);
              const ln = d3line<(typeof r)[0]>().x((d) => x(d.missing_share * 100)).y((d) => y(d.overlap * 100))(r)!;
              return (
                <>
                  <AxisLeft scale={y} w={w} ticks={5} format={(v) => `${v}%`} label="Top-10 list unchanged" />
                  <AxisBottom scale={x} h={h} ticks={5} format={(v) => `${v}%`} label="Real roads missing from data" />
                  <path d={ln} fill="none" stroke={C.cut} strokeWidth={2.4} />
                  {r.map((d) => <g key={d.missing_share}><circle cx={x(d.missing_share * 100)} cy={y(d.overlap * 100)} r={4.5} fill={C.cut} /><text x={x(d.missing_share * 100)} y={y(d.overlap * 100) - 10} textAnchor="middle" className="lbl">{Math.round(d.overlap * 100)}%</text></g>)}
                </>
              );
            }}
          </Chart>
        </div>
        <div>
          <div className="mp__t">Headline cut-off share barely moves (percentage points)</div>
          <Chart height={260} label="Change in mean cut-off share as roads go missing" margin={{ t: 22, r: 18, b: 44, l: 50 }}>
            {(w, h) => {
              const x = scaleBand<string>().domain(r.map((d) => `${Math.round(d.missing_share * 100)}%`)).range([0, w]).padding(0.35), y = scaleLinear().domain([-2, 2]).range([h, 0]);
              return (
                <>
                  <AxisLeft scale={y} w={w} ticks={4} format={(v) => `${v > 0 ? "+" : ""}${v}`} label="Shift in cut-off share (points)" />
                  <AxisBottom scale={x} h={h} label="Real roads missing" />
                  <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={C.ink} />
                  {r.map((d) => { const k = `${Math.round(d.missing_share * 100)}%`, v = d.delta * 100; return <g key={k}><rect x={x(k)} y={v >= 0 ? y(v) : y(0)} width={x.bandwidth()} height={Math.abs(y(v) - y(0))} fill={C.flood} /><text x={x(k)! + x.bandwidth() / 2} y={(v >= 0 ? y(v) : y(v)) + (v >= 0 ? -7 : 15)} textAnchor="middle" className="lbl">{v > 0 ? "+" : ""}{v.toFixed(1)}</text></g>; })}
                </>
              );
            }}
          </Chart>
        </div>
        <div>
          <div className="mp__t">Result against the way roads are joined</div>
          <Chart height={260} label="Mean cut-off share by snapping tolerance" margin={{ t: 22, r: 18, b: 44, l: 50 }}>
            {(w, h) => {
              const x = scaleBand<string>().domain(s.map((d) => `${d.snap_m} m`)).range([0, w]).padding(0.35), y = scaleLinear().domain([0, 30]).range([h, 0]);
              return (
                <>
                  <AxisLeft scale={y} w={w} ticks={5} format={(v) => `${v}%`} label="Mean residents cut off" />
                  <AxisBottom scale={x} h={h} label="Snapping tolerance" />
                  {s.map((d) => { const k = `${d.snap_m} m`; return <g key={k}><rect x={x(k)} y={y(d.share_cut_off * 100)} width={x.bandwidth()} height={h - y(d.share_cut_off * 100)} fill={C.flood2} /><text x={x(k)! + x.bandwidth() / 2} y={y(d.share_cut_off * 100) - 7} textAnchor="middle" className="lbl">{(d.share_cut_off * 100).toFixed(1)}%</text></g>; })}
                </>
              );
            }}
          </Chart>
        </div>
      </div>
      <div className="tbl-wrap" style={{ maxWidth: 760, marginTop: 18 }}>
        <table className="tbl">
          <thead><tr><th>Travel speed</th><th className="r">Mean time after flood</th><th className="r">Residents cut off</th><th className="r">Unmet (optimiser)</th><th className="r">Truck-hours used</th></tr></thead>
          <tbody>{sp.map((d) => <tr key={d.speed_factor}><td>x{d.speed_factor}</td><td className="r">{d.mean_time_after_min.toFixed(1)} min</td><td className="r">{pct(d.share_cut_off, 1)}</td><td className="r">{fmt(d.unmet_access_opt)}</td><td className="r">{fmt(d.truck_hours_access_opt, 1)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

/* tables */
export function FloodImpact({ ev }: { ev: Evidence }) {
  const rows = ev.access_by_severity.filter((r) => r.config === THREE);
  return (
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Severity</th><th className="r">Residents cut off</th><th className="r">Cut off or delayed 30+ min</th><th className="r">Median time after</th><th className="r">90th pct after</th><th className="r">Facilities out</th><th className="r">Reachable from hubs</th></tr></thead>
      <tbody>{SEV.map((s) => { const r = rows.find((x) => x.severity === s); return r && <tr key={s}><td style={{ textTransform: "capitalize" }}>{s}</td><td className="r"><b>{pct(r.share_cut_off, 1)}</b></td><td className="r">{fmt(r.pop_delayed)}</td><td className="r">{r.median_time_after_min.toFixed(1)} min</td><td className="r">{r.p90_time_after_min.toFixed(1)} min</td><td className="r">{r.facilities_out.toFixed(1)}</td><td className="r">{pct(r.depot_reach_share)}</td></tr>; })}</tbody>
    </table></div>
  );
}

export function MethodTable({ ev }: { ev: Evidence }) {
  const [fleet, setFleet] = useState(2);
  return (
    <div>
      <FleetPick v={fleet} set={setFleet} />
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Depots</th><th>Severity</th>{POLICIES.map((p) => <th key={p} className="r">{POLICY_LABEL[p]}</th>)}</tr></thead>
        <tbody>
          {[SINGLE, RESILIENT, THREE].flatMap((cfg) => SEV.map((sev) => {
            const row = POLICIES.map((p) => ev.alloc_means.find((r) => r.config === cfg && r.fleet === fleet && r.severity === sev && r.policy === p).unmet as number);
            const best = Math.min(...row);
            return <tr key={cfg + sev} className={cfg === THREE ? "hl" : ""}><td>{cfg}</td><td style={{ textTransform: "capitalize" }}>{sev}</td>{row.map((v, i) => <td key={i} className="r" style={{ fontWeight: v === best ? 700 : 400 }}>{fmt(v)}</td>)}</tr>;
          }))}
        </tbody>
      </table></div>
      <p className="tbl-cap"><b>Table C</b> Mean unmet demand (units over 14 days) over 20 generated floods per severity, {fleet} trucks. Lowest in each row in bold. Does not include demand inside cut-off villages, which no road delivery can reach.</p>
    </div>
  );
}

export function PairedTable({ ev }: { ev: Evidence }) {
  const [fleet, setFleet] = useState(4);
  const rows = ev.paired.filter((r) => r.config === THREE && r.severity === "all" && r.fleet === fleet);
  const order: Policy[] = ["none", "proportional", "nearest_first", "nearest_first_post"];
  return (
    <div>
      <FleetPick v={fleet} set={setFleet} />
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Optimiser compared with</th><th className="r">Mean difference (units)</th><th className="r">95% CI</th><th className="r">Better in</th><th className="r">Tied in</th><th className="r">Wilcoxon p</th></tr></thead>
        <tbody>{order.map((ref) => { const r = rows.find((x) => x.reference === ref); return r && <tr key={ref}><td>{POLICY_LABEL[ref]}</td><td className="r"><b>{fmt(r.mean_diff)}</b></td><td className="r">[{fmt(r.ci_low)}, {fmt(r.ci_high)}]</td><td className="r">{pct(r.win_rate)}</td><td className="r">{pct(r.tie_rate)}</td><td className="r">{r.wilcoxon_p == null ? "n/a (all ties)" : Number(r.wilcoxon_p).toExponential(1)}</td></tr>; })}</tbody>
      </table></div>
      <p className="tbl-cap"><b>Table D</b> Paired comparison over all 60 generated floods, three hubs, {fleet} trucks. Negative means the optimiser leaves less unmet. Bootstrap CIs use 2,000 resamples (seed 42).</p>
    </div>
  );
}

export function ValidationChecks({ ev }: { ev: Evidence }) {
  const v = ev.validation;
  const items = [
    { ok: v.circuity_plausible_1_to_2, t: "Road circuity", d: `Road distance over straight-line distance to the nearest facility: median ${v.circuity_median.toFixed(2)}, 90th percentile ${v.circuity_p90.toFixed(2)}. Plausible range 1 to 2.` },
    { ok: v.pop_assigned_equals_connected, t: "Conservation", d: "Residents assigned to facilities equal the connected residents; nobody is counted twice or lost." },
    { ok: v.severity_monotonic, t: "Monotonicity", d: `Mean residents cut off rises with severity: mild ${pct(v.share_cut_off_by_severity.mild, 1)}, moderate ${pct(v.share_cut_off_by_severity.moderate, 1)}, severe ${pct(v.share_cut_off_by_severity.severe, 1)}.` },
    { ok: null, t: "Known mismatch (declared)", d: `The nearest facility by road time equals the nearest by straight line for ${pct(v.nearest_facility_agreement_pop_weighted)} of residents. The generated stock used straight-line catchments, so 11 facilities serve nobody on a travel-time basis.` },
  ];
  return (
    <ul className="checks">
      {items.map((i) => <li key={i.t}><span className={`checks__m ${i.ok === true ? "ok" : i.ok === false ? "no" : "warn"}`}>{i.ok === true ? "✓" : i.ok === false ? "✕" : "!"}</span><div><b>{i.t}</b><p>{i.d}</p></div></li>)}
    </ul>
  );
}
