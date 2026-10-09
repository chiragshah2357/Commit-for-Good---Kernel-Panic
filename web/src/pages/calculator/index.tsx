import { useMemo, useState } from "react";
import { MapCanvas, Tool } from "../../components/map/MapCanvas";
import { api } from "../../lib/api";
import { C } from "../../lib/colors";
import { fmt } from "../../lib/format";
import { useGeometry, useScenarios } from "../../lib/data";
import { Controls } from "./Controls";
import { useEnsemble, useOnDemand, usePareto, usePreview, useRequest, useSimulate } from "./hooks";
import { KpiStrip, Overview } from "./panels1";
import { Delivery, Methods, Priorities, Risk } from "./panels2";
import { Tab, useCalc } from "./store";
import "../../styles/calc.css";

const TABS: { id: Tab; label: string }[] = [{ id: "overview", label: "Overview" }, { id: "methods", label: "Methods" }, { id: "delivery", label: "Delivery plan" }, { id: "priorities", label: "Priorities" }, { id: "risk", label: "Risk and fleet" }];
const STATUS_L = ["connected", "delayed", "cut off", "not connected in the data"];

export default function Calculator() {
  const geo = useGeometry(), scn = useScenarios();
  const s = useCalc();
  const req = useRequest(s);
  const sim = useSimulate(req);
  const preview = usePreview(req, s.floodMode !== "preset");
  const ens = useEnsemble(req, s.tab === "methods" || s.tab === "risk");
  const par = usePareto(req, s.tab === "risk");
  const repair = useOnDemand("repair", api.repair, req);
  const unc = useOnDemand("unc", (r, sg) => api.uncertainty({ ...r, missing_share: s.missingShare, reps: 24 }, sg), req, s.missingShare);
  const [focus, setFocus] = useState<{ lon: number; lat: number; zoom: number } | null>(null);

  const preset = scn?.presets.find((p) => p.name === s.preset);
  const cutArr = s.floodMode === "preset" ? preset?.cut : s.floodMode === "draw" ? s.cutDraft : preview.data?.cut_segments;
  const outArr = s.floodMode === "preset" ? preset?.out : s.floodMode === "draw" ? s.outDraft : preview.data?.out_facilities;
  const cut = useMemo(() => new Set(cutArr ?? sim.data?.scenario.cut_segments ?? []), [cutArr, sim.data]);
  const out = useMemo(() => new Set(outArr ?? sim.data?.scenario.out_facilities ?? []), [outArr, sim.data]);
  const hubs = useMemo(() => (s.hubConfig === "custom" ? (sim.data?.hubs ?? s.hubPoints.map(([lon, lat]) => ({ lon, lat }))) : geo ? (s.hubConfig === "single" ? geo.hubs.single : geo.hubs.three) : []), [s.hubConfig, s.hubPoints, sim.data, geo]);
  const deliver = useMemo(() => new Map((sim.data?.chosen.facilities ?? []).filter((f) => f.deliver > 0).map((f) => [f.id, f.deliver])), [sim.data]);
  const pulse = useMemo(() => new Set(s.showRepair && s.tab === "priorities" ? (repair.data?.rows ?? []).map((r) => r.seg_id) : []), [repair.data, s.showRepair, s.tab]);

  const toggle = (arr: number[], id: number) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const onRoad = (id: number) => s.set({ floodMode: "draw", cutDraft: toggle(s.floodMode === "draw" ? s.cutDraft : [...cut], id), outDraft: s.floodMode === "draw" ? s.outDraft : [...out] });
  const onFacility = (id: number) => { if (s.tool === "out") s.set({ floodMode: "draw", outDraft: toggle(s.floodMode === "draw" ? s.outDraft : [...out], id), cutDraft: s.floodMode === "draw" ? s.cutDraft : [...cut] }); };
  const onPoint = (lon: number, lat: number) => { if (s.hubPoints.length < 6) s.set({ hubConfig: "custom", hubPoints: [...s.hubPoints, [lon, lat]] }); };

  const tip = (kind: "village" | "facility" | "road", i: number) => {
    if (!geo) return null;
    if (kind === "village") {
      const st = sim.data?.villages.status[i], b = sim.data?.villages.time_before[i], a = sim.data?.villages.time_after[i];
      return <><b>{geo.villages.name[i]}</b>{fmt(geo.villages.pop[i])} residents{sim.data && <div className="mono">{STATUS_L[st ?? 0]}<br />{b == null ? "no route in the data" : `${b.toFixed(0)} min before`}{a == null && st === 2 ? " · no route after" : a != null && b != null ? ` → ${a.toFixed(0)} min` : ""}</div>}</>;
    }
    if (kind === "facility") {
      const f = sim.data?.chosen.facilities[i];
      return <><b>{geo.facilities.name[i]}</b>stock {fmt(geo.facilities.stock[i])} units{f && <div className="mono">{!f.working ? "out of service" : f.deliver > 0 ? `+${fmt(f.deliver)} delivered` : "no delivery"}<br />unmet {fmt(f.unmet)}</div>}{s.tool === "out" && <div className="mono">click to toggle outage</div>}</>;
    }
    const r = geo.roads[i];
    return <><b>{r.n || `Segment ${r.id}`}</b><span className="mono">{r.c} · {r.k.toFixed(1)} km<br />{cut.has(r.id) ? "cut · click to restore" : "click to cut"}</span></>;
  };

  const offline = sim.error && !sim.data;
  const tool = s.tool as Tool;
  return (
    <main className="calc">
      <aside className="calc__ctl">{scn ? <Controls presets={scn.presets} preview={preview.data} sim={sim.data} /> : <div className="skel" style={{ height: 400 }} />}</aside>
      <section className="calc__main">
        <div className="calc__map">
          {geo ? (
            <MapCanvas geo={geo} interactive tool={tool} cut={cut} facilityOut={out} facilityDeliver={deliver} villageMode={sim.data ? "status" : "neutral"} villageStatus={sim.data?.villages.status}
                       hubs={hubs} depot={s.hubConfig !== "single"} routes={sim.data?.chosen.routes.map((r) => ({ path: r.path, units: r.units }))} routesOn={s.showRoutes}
                       highlightRoads={pulse} pulseRoads={pulse} layers={{ rivers: s.showRivers, routes: s.showRoutes }} padding={22} focusTarget={focus}
                       onRoad={onRoad} onFacility={onFacility} onPoint={onPoint} tip={tip} />
          ) : <div className="skel" style={{ width: "100%", height: "100%" }} />}
          <div className="calc__tools">
            {([["pan", "Pan"], ["cut", "Cut road"], ["out", "Facility out"], ["hub", "Place hub"]] as [Tool, string][]).map(([t, l]) => (
              <button key={t} className="chip" aria-pressed={s.tool === t} onClick={() => s.set({ tool: t, ...(t === "hub" ? { hubConfig: "custom" as const } : {}) })}>{l}</button>
            ))}
            <span className="calc__sep" />
            <button className="chip" aria-pressed={s.showRoutes} onClick={() => s.set({ showRoutes: !s.showRoutes })}>Routes</button>
            <button className="chip" aria-pressed={s.showRivers} onClick={() => s.set({ showRivers: !s.showRivers })}>Rivers</button>
          </div>
          <div className="calc__legend">
            <span><i style={{ background: "#2f6b5e" }} />connected</span><span><i style={{ background: C.delay }} />delayed</span><span><i style={{ background: C.cut }} />cut off</span><span><i style={{ background: C.grey }} />not connected in data</span>
            <span><i className="ln" style={{ background: C.cut }} />road cut</span><span><i className="ln" style={{ background: C.flood }} />route</span>
          </div>
          {sim.loading && <div className="calc__busy" aria-live="polite"><i />updating</div>}
          <div className="calc__stamps"><span className="stamp stamp--gen">Generated flood and stock</span></div>
        </div>

        {offline ? (
          <div className="calc__off"><h3 className="display">The calculator needs its API</h3><p>The maps and evidence pages work without it, but live what-if runs need the Python engine. In the repository root run:</p><pre className="mono">python -m floodready serve</pre><p className="mono">{sim.error}</p></div>
        ) : (
          <>
            {sim.data ? <KpiStrip sim={sim.data} loading={sim.loading} /> : <div className="kp"><div className="kp__c skel" style={{ height: 76 }} /></div>}
            <div className="calc__tabs" role="tablist">{TABS.map((t) => <button key={t.id} role="tab" aria-selected={s.tab === t.id} className={s.tab === t.id ? "on" : ""} onClick={() => s.set({ tab: t.id })}>{t.label}</button>)}</div>
            <div className="calc__panel" key={s.tab}>
              {!sim.data ? <div className="wait"><i />Loading the road network and running the first flood…</div> : s.tab === "overview" ? <Overview sim={sim.data} />
                : s.tab === "methods" ? <Methods sim={sim.data} ens={ens} />
                : s.tab === "delivery" ? <Delivery sim={sim.data} />
                : s.tab === "priorities" && geo ? <Priorities sim={sim.data} geo={geo} repair={repair} onFocus={(lon, lat) => setFocus({ lon, lat, zoom: 7 })} />
                : s.tab === "risk" ? <Risk sim={sim.data} ens={ens} par={par} unc={unc} /> : null}
              <p className="calc__disc mono">All floods, stock, depot and fleet are generated (seed 42). Results show how a method behaves under stated assumptions, not a measured outcome.</p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
