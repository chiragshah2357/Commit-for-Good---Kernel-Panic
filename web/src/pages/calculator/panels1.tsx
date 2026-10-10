import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Tip, useTip } from "../../components/charts/kit";
import { Counter } from "../../components/ui";
import { C } from "../../lib/colors";
import { fmt, pct } from "../../lib/format";
import { FacilityRow, IndexResult, POLICY_LABEL, SimResult } from "../../lib/types";

export const BAND = (v: number) => (v >= 80 ? { l: "robust", c: C.ok } : v >= 60 ? { l: "strained", c: C.delay } : v >= 40 ? { l: "degraded", c: "#c2652b" } : { l: "failing", c: C.cut });

/* ---------- headline numbers ---------- */
export function KpiStrip({ sim, loading }: { sim: SimResult; loading: boolean }) {
  const a = sim.access, ch = sim.policies[sim.chosen.policy], none = sim.policies.none;
  const idx = ch.index.value, b = BAND(idx);
  return (
    <div className={`kp ${loading ? "kp--busy" : ""}`}>
      <div className="kp__c kp__c--cut"><span className="eyebrow">Residents cut off</span><Counter className="kp__v display" value={a.pop_cut_off} live duration={0.7} /><small>{pct(a.share_cut_off, 1)} of {fmt(a.population)} · {a.villages_cut_off} villages</small></div>
      <div className="kp__c"><span className="eyebrow">Delayed, still connected</span><Counter className="kp__v display" value={a.pop_delayed_only} live duration={0.7} /><small>mean trip {a.mean_before?.toFixed(1)} to {a.mean_after?.toFixed(1)} min</small></div>
      <div className="kp__c"><span className="eyebrow">Facilities out</span><span className="kp__v display"><Counter value={sim.scenario.facilities_out} live duration={0.6} /><em> / 87</em></span><small>{sim.scenario.segments_cut} segments cut · {pct(sim.scenario.share_road_cut, 0)} of road</small></div>
      <div className="kp__c"><span className="eyebrow">Unmet demand after plan</span><Counter className="kp__v display" value={ch.total_unmet_units} live duration={0.7} /><small>{fmt(none.total_unmet_units)} if nothing is done · units · {ch.hubs} {ch.hubs === 1 ? "depot" : "hubs"}</small></div>
      <div className="kp__c kp__c--idx"><span className="eyebrow">Resilience Index</span><span className="kp__v display" style={{ color: b.c }}><Counter value={idx} decimals={1} live duration={0.7} /></span><small style={{ color: b.c, fontWeight: 600 }}>{b.l} · do nothing {none.index.value.toFixed(1)}</small></div>
    </div>
  );
}

/* ---------- semicircular gauge ---------- */
function Gauge({ value, ref0, nf }: { value: number; ref0: number; nf: number }) {
  const R = 92, cx = 110, cy = 108;
  const pt = (v: number, r = R) => { const a = Math.PI * (1 - v / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const; };
  const arc = (v0: number, v1: number, r = R) => { const [x0, y0] = pt(v0, r), [x1, y1] = pt(v1, r); return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`; };
  const [nx, ny] = pt(value, R - 12), b = BAND(value);
  return (
    <svg viewBox="0 0 220 140" className="gauge" role="img" aria-label={`Resilience index ${value.toFixed(1)} out of 100, ${b.l}`}>
      {[[0, 40, C.cutSoft], [40, 60, "#f0d9c4"], [60, 80, C.delaySoft], [80, 100, C.okSoft]].map(([a0, a1, c]) => <path key={a0 as number} d={arc(a0 as number, a1 as number)} stroke={c as string} strokeWidth={16} fill="none" />)}
      <motion.path d={arc(0, 100)} stroke={b.c} strokeWidth={16} fill="none" strokeLinecap="butt" initial={false} animate={{ pathLength: value / 100 }} transition={{ duration: 0.8, ease: [0.22, 0.8, 0.2, 1] }} />
      {[ref0, nf].map((v, i) => { const [x0, y0] = pt(v, R - 12), [x1, y1] = pt(v, R + 12); return <g key={i}><line x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.ink} strokeWidth={2} strokeDasharray={i ? "0" : "2 2"} /><text x={pt(v, R + 22)[0]} y={pt(v, R + 22)[1]} textAnchor="middle" style={{ fontSize: 8, fontFamily: "var(--font-mono)", fill: C.ink2 }}>{i ? "no flood" : "nothing"}</text></g>; })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.ink} strokeWidth={2.5} /><circle cx={cx} cy={cy} r={5} fill={C.ink} />
      <text x={cx} y={cy + 26} textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 560, fill: b.c }}>{value.toFixed(1)}</text>
    </svg>
  );
}

/* `demand` is the denominator label for the current set-up, so the formula follows the planning horizon and demand rate. */
const COMP: { k: keyof IndexResult["components"]; l: string; f: (demand: string) => string }[] = [
  { k: "access", l: "Access retained", f: () => "1 − (residents cut off or delayed) ÷ (connected residents)" },
  { k: "supply", l: "Supply continuity", f: (demand) => `1 − (unmet units + units in cut-off villages) ÷ (${demand})` },
  { k: "equity", l: "Equity", f: () => "1 − (working facilities more than 25% short) ÷ (working facilities)" },
  { k: "reach", l: "Hub reach", f: () => "(working facilities a hub can reach) ÷ (working facilities)" },
];

export function IndexCard({ sim }: { sim: SimResult }) {
  const ch = sim.policies[sim.chosen.policy], idx = ch.index;
  const [math, setMath] = useState(false);
  const horizon = Number((sim.setup as any).horizon) || 14, rate = Number((sim.setup as any).rate_mult) || 1;
  const demand = `${horizon}-day demand${Math.abs(rate - 1) > 1e-9 ? ` at ${rate.toFixed(2)}x the base rate` : ""}`;
  return (
    <div className="card idx">
      <div className="card__h"><h4>Flood-Access Resilience Index</h4><button className="linkbtn" onClick={() => setMath(!math)}>{math ? "hide the math" : "show the math"}</button></div>
      <div className="idx__body">
        <Gauge value={idx.value} ref0={sim.policies.none.index.value} nf={sim.no_flood_index.value} />
        <div className="idx__rows">
          {COMP.map((c) => (
            <div key={c.k} className="idx__r">
              <div className="idx__rh"><span>{c.l}</span><b className="mono">{(idx.components[c.k] * 100).toFixed(0)}%</b><span className="idx__w mono">w {idx.weights[c.k].toFixed(2)} → {idx.contributions[c.k].toFixed(1)} pts</span></div>
              <div className="bar"><motion.i initial={false} animate={{ width: `${idx.components[c.k] * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 0.8, 0.2, 1] }} /></div>
              {math && <div className="idx__f">{c.f(demand)}</div>}
            </div>
          ))}
        </div>
      </div>
      {math && <p className="card__note mono">RI = 100 × Σ wₖ·cₖ = {idx.value.toFixed(1)}. A judgement-weighted summary for comparing options on the same flood; not validated against real outcomes. Pre-flood (no flood, same set-up): <b>{sim.no_flood_index.value.toFixed(1)}</b>, because the generated stock is already short at some facilities.</p>}
    </div>
  );
}

/* ---------- where the demand goes ---------- */
export function Decomposition({ sim }: { sim: SimResult }) {
  const d = sim.decomposition;
  const parts = [
    { k: "useful", l: "Covered by this plan", v: Math.max(d.useful_delivered, 0), c: C.flood },
    { k: "short", l: "Reachable but not served", v: Math.max(d.reachable_not_served, 0), c: C.delay },
    { k: "unreach", l: "Facilities no truck can reach", v: Math.max(d.unreachable_facilities, 0), c: C.grey },
    { k: "cut", l: "Inside cut-off villages", v: Math.max(d.cut_off_villages, 0), c: C.cut },
  ];
  const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
  const { tip, show, hide } = useTip<(typeof parts)[0]>();
  return (
    <div className="card">
      <div className="card__h"><h4>Where the demand at risk ends up</h4><span className="mono card__s">{fmt(tot)} units over {String((sim.setup as any).horizon)} days</span></div>
      <div className="stack">{parts.map((p) => <motion.div key={p.k} className="stack__s" style={{ background: p.c }} initial={false} animate={{ flexGrow: p.v }} transition={{ duration: 0.7, ease: [0.22, 0.8, 0.2, 1] }} onMouseMove={(e) => show(e, p)} onMouseLeave={hide} title={`${p.l}: ${fmt(p.v)}`} />)}</div>
      <div className="stack__l">{parts.map((p) => <span key={p.k}><i style={{ background: p.c }} />{p.l} <b className="mono">{fmt(p.v)}</b> <em>{((p.v / tot) * 100).toFixed(0)}%</em></span>)}</div>
      <p className="card__note">Roads decide the floor: units inside cut-off villages and at unreachable facilities cannot be delivered by road whatever the method. Information about who each facility now serves removed <b className="mono">{fmt(d.removed_by_information)}</b> units here, optimisation a further <b className="mono">{fmt(d.removed_by_optimisation)}</b>.</p>
      <Tip tip={tip}>{tip && <><b>{tip.d.l}</b><br />{fmt(tip.d.v)} units</>}</Tip>
    </div>
  );
}

/* ---------- access before and after ---------- */
export function AccessCard({ sim }: { sim: SimResult }) {
  const a = sim.access;
  const rows = [["Median trip", a.median_before, a.median_after], ["90th percentile", a.p90_before, a.p90_after], ["Mean trip", a.mean_before, a.mean_after]] as const;
  const mx = Math.max(...rows.flatMap((r) => [r[1] ?? 0, r[2] ?? 0]), 1);
  return (
    <div className="card">
      <div className="card__h"><h4>Minutes to the nearest working facility</h4><span className="mono card__s">connected residents</span></div>
      <div className="ab">{rows.map(([l, b, af]) => (
        <div key={l} className="ab__r"><span>{l}</span>
          <div className="ab__bars"><div className="ab__b"><motion.i initial={false} animate={{ width: `${((b ?? 0) / mx) * 100}%` }} style={{ background: C.ok }} /><b className="mono">{b?.toFixed(1)}</b></div><div className="ab__b"><motion.i initial={false} animate={{ width: `${((af ?? 0) / mx) * 100}%` }} style={{ background: C.cut }} /><b className="mono">{af?.toFixed(1)}</b></div></div>
        </div>))}
      </div>
      <p className="card__note"><i className="dot" style={{ background: C.ok }} />before the flood <i className="dot" style={{ background: C.cut }} />after. Residents with no route at all ({fmt(a.pop_cut_off)}) are not in these averages; they are counted as cut off.</p>
    </div>
  );
}

/* ---------- one cell per facility ---------- */
export function FacilityStrip({ rows }: { rows: FacilityRow[] }) {
  const { tip, show, hide } = useTip<FacilityRow>();
  const cls = (r: FacilityRow) => (!r.working ? "out" : r.depot_min == null ? "unr" : r.demand <= 0 ? "ok" : r.unmet / r.demand > 0.25 ? "bad" : r.unmet > 0.5 ? "some" : "ok");
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.working === b.working ? b.unmet / (b.demand || 1) - a.unmet / (a.demand || 1) : a.working ? -1 : 1)), [rows]);
  const cnt = (k: string) => rows.filter((r) => cls(r) === k).length;
  return (
    <div className="card">
      <div className="card__h"><h4>Every facility after the plan</h4><span className="mono card__s">{rows.length} facilities</span></div>
      <div className="fstrip">{sorted.map((r) => <i key={r.id} className={`f f--${cls(r)}`} onMouseMove={(e) => show(e, r)} onMouseLeave={hide} />)}</div>
      <div className="legend" style={{ marginTop: 10 }}>
        <span><i className="sq" style={{ background: C.ok }} />covered ({cnt("ok")})</span><span><i className="sq" style={{ background: C.delay }} />short ({cnt("some")})</span><span><i className="sq" style={{ background: C.cut }} />over 25% short ({cnt("bad")})</span>
        <span><i className="sq" style={{ background: C.grey }} />no truck can reach ({cnt("unr")})</span><span><i className="sq" style={{ background: "transparent", border: `2px solid ${C.cut}` }} />out of service ({cnt("out")})</span>
      </div>
      <Tip tip={tip}>{tip && <><b>{tip.d.name}</b><br />{tip.d.working ? <>stock {fmt(tip.d.stock)} · demand {fmt(tip.d.demand)}<br />delivered {fmt(tip.d.deliver)} · unmet {fmt(tip.d.unmet)}<br />{tip.d.depot_min == null ? "no road route from any hub" : `${tip.d.depot_min.toFixed(0)} min from hub ${tip.d.hub + 1}`}</> : "out of service in this flood"}</>}</Tip>
    </div>
  );
}

export function Overview({ sim }: { sim: SimResult }) {
  return (
    <div className="pan">
      <IndexCard sim={sim} />
      <Decomposition sim={sim} />
      <AccessCard sim={sim} />
      <FacilityStrip rows={sim.chosen.facilities} />
    </div>
  );
}

export { POLICY_LABEL };
