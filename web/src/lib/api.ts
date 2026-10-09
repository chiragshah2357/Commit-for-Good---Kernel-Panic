import type { EnsembleResult, Meta, ParetoResult, PreviewResult, RepairResult, Req, SimResult, UncertaintyResult } from "./types";

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export const api = {
  health: (signal?: AbortSignal) => fetch("/api/health", { signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
  meta: (): Promise<Meta> => fetch("/api/meta").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
  simulate: (b: Req, s?: AbortSignal) => post<SimResult>("simulate", b, s),
  ensemble: (b: Req, s?: AbortSignal) => post<EnsembleResult>("ensemble", b, s),
  pareto: (b: Req, s?: AbortSignal) => post<ParetoResult>("pareto", b, s),
  repair: (b: Req, s?: AbortSignal) => post<RepairResult>("repair", b, s),
  uncertainty: (b: Req & { missing_share: number; reps: number }, s?: AbortSignal) => post<UncertaintyResult>("uncertainty", b, s),
  preview: (b: Req, s?: AbortSignal) => post<PreviewResult>("flood/preview", b, s),
};
