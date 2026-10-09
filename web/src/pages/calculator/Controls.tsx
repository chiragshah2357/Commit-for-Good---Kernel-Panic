import { ReactNode, useRef } from "react";
import { Stamp } from "../../components/ui";
import { fmt, pct } from "../../lib/format";
import { POLICIES, POLICY_COLOR, POLICY_LABEL, Policy, PreviewResult, Preset, SimResult } from "../../lib/types";
import { DEFAULT_WEIGHTS, useCalc } from "./store";

const POLICY_NOTE: Record<Policy, string> = {
  none: "Nothing is delivered. The reference.",
  proportional: "Stock split by pre-flood catchment population.",
  nearest_first: "Fills pre-flood shortfalls, nearest facility first. What an officer without the access analysis would do.",
  nearest_first_post: "Same rule, but on post-flood shortfalls: isolates the value of information.",
  access_opt: "Integer programme on post-flood needs and travel times: information plus optimisation.",
};

function Group({ title, tag, open = true, children }: { title: string; tag?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="cg" open={open}>
      <summary><span className="cg__t">{title}</span>{tag}<i aria-hidden /></summary>
      <div className="cg__b">{children}</div>
    </details>
  );
}

function Slider({ label, value, min, max, step, onChange, fmtv, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmtv?: (v: number) => string; hint?: string }) {
  return (
    <label className="sl">
      <span className="sl__h"><span>{label}</span><b className="mono">{fmtv ? fmtv(value) : value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ ["--p" as string]: `${((value - min) / (max - min)) * 100}%` }} />
      {hint && <span className="sl__hint">{hint}</span>}
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return <div className="seg" role="tablist">{options.map((o) => <button key={o.v} role="tab" aria-selected={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.l}</button>)}</div>;
}

export function Controls({ presets, preview, sim }: { presets: Preset[]; preview: PreviewResult | null; sim: SimResult | null }) {
  const s = useCalc();
  const fileRef = useRef<HTMLInputElement>(null);
  const sev = (s.preset.split("_")[0] as "mild" | "moderate" | "severe") ?? "severe";
  const rep = +s.preset.split("_")[1] || 0;
  const cur = presets.find((p) => p.name === s.preset);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const cut: number[] = [], out: number[] = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.split(/[,\s;]+/).filter(Boolean);
      const id = [...t].reverse().map(Number).find((n) => Number.isInteger(n));
      if (id === undefined) continue;
      (t.includes("facility") ? out : cut).push(id);
    }
    s.set({ floodMode: "draw", cutDraft: [...new Set(cut)], outDraft: [...new Set(out)], tool: "pan" });
  };

  return (
    <div className="ctl">
      <Group title="1 · The flood" tag={<Stamp kind="gen" />}>
        <Seg value={s.floodMode} onChange={(v) => s.set({ floodMode: v, tool: v === "draw" ? "cut" : "pan" })}
             options={[{ v: "preset", l: "Preset (60)" }, { v: "draw", l: "Draw" }, { v: "river", l: "River" }]} />
        {s.floodMode === "preset" && (
          <>
            <div className="chips">{(["mild", "moderate", "severe"] as const).map((v) => <button key={v} className="chip" aria-pressed={sev === v} onClick={() => s.set({ preset: `${v}_${String(rep).padStart(2, "0")}` })}>{v}</button>)}</div>
            <Slider label="Replicate" value={rep} min={0} max={19} step={1} onChange={(v) => s.set({ preset: `${sev}_${String(v).padStart(2, "0")}` })} fmtv={(v) => String(v).padStart(2, "0")} />
            {cur && <p className="ctl__sum mono"><b>{pct(cur.share_road_cut, 1)}</b> of road cut · <b>{cur.segments_cut}</b> segments · <b>{cur.facilities_out}</b> facilities out<br />height {fmt(cur.height_m, 2)} m · reach {fmt(cur.distance_m)} m from rivers</p>}
            <p className="ctl__hint">Switch to <b>Draw</b> or pick the cut tool on the map to edit this flood: click any road to cut it, and see who loses care.</p>
          </>
        )}
        {s.floodMode === "draw" && (
          <>
            <div className="chips">
              <button className="chip" aria-pressed={s.tool === "cut"} onClick={() => s.set({ tool: "cut" })}>Cut roads</button>
              <button className="chip" aria-pressed={s.tool === "out"} onClick={() => s.set({ tool: "out" })}>Facility out</button>
              <button className="chip" aria-pressed={s.tool === "pan"} onClick={() => s.set({ tool: "pan" })}>Pan</button>
            </div>
            <p className="ctl__sum mono"><b>{s.cutDraft.length}</b> road segments cut · <b>{s.outDraft.length}</b> facilities out{preview ? <> · <b>{pct(preview.share_cut_off, 1)}</b> of residents cut off</> : null}</p>
            <div className="chips">
              <button className="btn btn--ghost btn--sm" onClick={() => s.set({ cutDraft: [], outDraft: [] })}>Clear</button>
              <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>Upload ids…</button>
              <input ref={fileRef} type="file" accept=".csv,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <p className="ctl__hint">Click a road on the map to cut it, click again to restore. Upload a CSV with one segment id per line, or rows like <span className="mono">road_segment,458</span> and <span className="mono">facility,1234</span>.</p>
          </>
        )}
        {s.floodMode === "river" && (
          <>
            <Slider label="Flood height above the nearest river" value={s.height} min={0.5} max={6} step={0.1} onChange={(v) => s.set({ height: v })} fmtv={(v) => `${v.toFixed(1)} m`} hint="Presets use 1.0 (mild), 2.5 (moderate), 4.5 m (severe)." />
            <Slider label="Reach from the river" value={s.distance} min={50} max={2500} step={25} onChange={(v) => s.set({ distance: v })} fmtv={(v) => `${fmt(v)} m`} hint="Presets use 150, 600, 1,500 m." />
            <Slider label="Facility outage draw (seed)" value={s.seed} min={1} max={99} step={1} onChange={(v) => s.set({ seed: v })} hint="Which flooded facilities fail (each with probability 0.5)." />
            {preview && <p className="ctl__sum mono"><b>{pct(preview.share_road_cut, 1)}</b> of road cut · <b>{preview.segments_cut}</b> segments · <b>{preview.facilities_out}</b> facilities out</p>}
          </>
        )}
      </Group>

      <Group title="2 · Depots and fleet" tag={<Stamp kind="gen" />}>
        <Seg value={s.hubConfig} onChange={(v) => s.set({ hubConfig: v, tool: v === "custom" ? "hub" : s.tool === "hub" ? "pan" : s.tool })}
             options={[{ v: "single", l: "Single depot" }, { v: "three", l: "Three hubs" }, { v: "custom", l: "Place hubs" }]} />
        {s.hubConfig === "custom" && (
          <p className="ctl__hint">{s.hubPoints.length ? <><b>{s.hubPoints.length}</b> hub{s.hubPoints.length > 1 ? "s" : ""} placed (max 6). Click the map to add; hubs snap to the nearest road junction.</> : <>Click the map to place a hub. It snaps to the nearest road junction.</>}
            {s.hubPoints.length > 0 && <> <button className="linkbtn" onClick={() => s.set({ hubPoints: [] })}>clear</button> <button className="linkbtn" onClick={() => s.set({ hubPoints: s.hubPoints.slice(0, -1) })}>undo</button></>}</p>
        )}
        {s.hubConfig === "single" && <p className="ctl__hint">One depot at Silchar centre (generated location).</p>}
        {s.hubConfig === "three" && <p className="ctl__hint">Three hubs chosen by greedy cover on 30 floods and tested on the other 30.</p>}
        <Slider label="Trucks" value={s.trucks} min={1} max={12} step={1} onChange={(v) => s.set({ trucks: v })} hint="3,000 units each, 10 working hours a day, 3-day window." />
        <Slider label="Depot stock" value={s.stockMult} min={0.25} max={3} step={0.05} onChange={(v) => s.set({ stockMult: v })} fmtv={(v) => `${v.toFixed(2)}x`} hint="1x = 10 days of district-wide demand (generated)." />
      </Group>

      <Group title="3 · Method and horizon">
        <div className="pol">{POLICIES.map((p) => (
          <button key={p} className={`pol__b ${s.policy === p ? "on" : ""}`} onClick={() => s.set({ policy: p })} aria-pressed={s.policy === p}>
            <i style={{ background: POLICY_COLOR[p] }} /><span><b>{POLICY_LABEL[p]}</b><small>{POLICY_NOTE[p]}</small></span>
          </button>
        ))}</div>
        <Slider label="Planning horizon" value={s.horizon} min={7} max={42} step={1} onChange={(v) => s.set({ horizon: v })} fmtv={(v) => `${v} days`} hint="Days of demand the stock must cover." />
        <Slider label="Demand rate" value={s.rateMult} min={0.5} max={2} step={0.05} onChange={(v) => s.set({ rateMult: v })} fmtv={(v) => `${v.toFixed(2)}x`} hint="1x = 0.002 treatment courses per person per day." />
        <Slider label="Counts as delayed after" value={s.delayMin} min={10} max={60} step={5} onChange={(v) => s.set({ delayMin: v })} fmtv={(v) => `+${v} min`} />
      </Group>

      <Group title="4 · Assumptions and score" open={false}>
        <Slider label="Travel speed" value={s.speed} min={0.7} max={1.3} step={0.05} onChange={(v) => s.set({ speed: v })} fmtv={(v) => `${v.toFixed(2)}x`} hint="Multiplies all road-class speeds (assumed, not measured)." />
        <div className="ctl__sub">Resilience Index weights</div>
        {(["access", "supply", "equity", "reach"] as const).map((k) => (
          <Slider key={k} label={{ access: "Access retained", supply: "Supply continuity", equity: "Equity", reach: "Hub reach" }[k]} value={s.weights[k]} min={0} max={1} step={0.05}
                  onChange={(v) => s.set({ weights: { ...s.weights, [k]: v } })} fmtv={(v) => v.toFixed(2)} />
        ))}
        <p className="ctl__hint">Weights are normalised to sum to 1. The index is a judgement-weighted summary, not a validated measure.</p>
        <button className="btn btn--ghost btn--sm" onClick={() => s.set({ weights: { ...DEFAULT_WEIGHTS } })}>Reset weights</button>
      </Group>

      <div className="ctl__foot">
        <button className="btn btn--ghost btn--sm" onClick={() => s.reset()}>Reset everything</button>
        {sim && <span className="mono">{sim.ms} ms</span>}
      </div>
    </div>
  );
}
