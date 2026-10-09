import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { EnsembleResult, ParetoResult, PreviewResult, RepairResult, Req, SimResult, UncertaintyResult } from "../../lib/types";
import { CalcState, toReq } from "./store";

export interface Async<T> { data: T | null; loading: boolean; error: string | null }

const cache = new Map<string, unknown>();
const remember = (k: string, v: unknown) => { cache.set(k, v); if (cache.size > 60) cache.delete(cache.keys().next().value as string); };

/** Debounced, abortable fetch that keeps showing the previous answer while the next one loads. */
export function useAsync<T>(name: string, fn: (r: Req, s: AbortSignal) => Promise<T>, req: Req | null, delay = 220): Async<T> {
  const [st, setSt] = useState<Async<T>>({ data: null, loading: false, error: null });
  const key = req ? `${name}:${JSON.stringify(req)}` : "";
  const last = useRef<T | null>(null);
  useEffect(() => {
    if (!req) return;
    if (cache.has(key)) { last.current = cache.get(key) as T; setSt({ data: last.current, loading: false, error: null }); return; }
    const ctl = new AbortController();
    setSt((s) => ({ ...s, loading: true, error: null }));
    const t = setTimeout(() => {
      fn(req, ctl.signal).then((d) => { remember(key, d); last.current = d; setSt({ data: d, loading: false, error: null }); })
        .catch((e) => { if (e.name !== "AbortError") setSt({ data: last.current, loading: false, error: String(e.message ?? e) }); });
    }, delay);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [key]);
  return st;
}

export function useRequest(s: CalcState): Req {
  const { floodMode, preset, cutDraft, outDraft, height, distance, seed, trucks, hubConfig, hubPoints, policy, stockMult, horizon, rateMult, speed, delayMin, weights } = s;
  return useMemo(() => toReq(s), [floodMode, preset, cutDraft, outDraft, height, distance, seed, trucks, hubConfig, hubPoints, policy, stockMult, horizon, rateMult, speed, delayMin, weights]);
}

export const useSimulate = (req: Req) => useAsync<SimResult>("sim", api.simulate, req, 180);
export const usePreview = (req: Req, on: boolean) => useAsync<PreviewResult>("prev", api.preview, on ? req : null, 120);

/** The 60-flood ensemble does not depend on which flood is on screen, so its key leaves the flood out. */
export function useEnsemble(req: Req, on: boolean) {
  const r = useMemo<Req>(() => ({ ...req, flood: { mode: "preset", preset: "severe_11" } }), [JSON.stringify(req.setup), JSON.stringify(req.weights)]);
  return useAsync<EnsembleResult>("ens", api.ensemble, on ? r : null, 350);
}

/** Fleet-size curve: the key leaves the truck count out. */
export function usePareto(req: Req, on: boolean) {
  const r = useMemo<Req>(() => ({ ...req, setup: { ...req.setup, trucks: 4 }, weights: null }), [JSON.stringify(req.flood), JSON.stringify({ ...req.setup, trucks: 0 })]);
  return useAsync<ParetoResult>("par", api.pareto, on ? r : null, 350);
}

/** On-demand analyses (repair priority, data-incompleteness band): run when asked, reset when the inputs change. */
export function useOnDemand<T>(name: string, fn: (r: Req, s: AbortSignal) => Promise<T>, req: Req, extra: unknown = null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${name}:${JSON.stringify(req.flood)}:${JSON.stringify(req.setup)}:${JSON.stringify(extra)}`;
  useEffect(() => { setData(null); setError(null); }, [key]);
  const ctl = useRef<AbortController | null>(null);
  const run = () => {
    ctl.current?.abort(); const c = (ctl.current = new AbortController());
    setLoading(true); setError(null);
    const k = `od:${key}:${JSON.stringify(req.weights)}`;
    if (cache.has(k)) { setData(cache.get(k) as T); setLoading(false); return; }
    fn(req, c.signal).then((d) => { remember(k, d); setData(d); }).catch((e) => e.name !== "AbortError" && setError(String(e.message ?? e))).finally(() => setLoading(false));
  };
  return { data, loading, error, run };
}

export type Uncertainty = UncertaintyResult;
export type Repair = RepairResult;
