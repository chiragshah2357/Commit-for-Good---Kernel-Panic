import { useEffect, useState } from "react";
import type { Evidence, Geometry, ScenariosFile } from "./types";

const cache = new Map<string, Promise<unknown>>();
function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) cache.set(name, fetch(`/data/${name}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${name}.json ${r.status}`)))));
  return cache.get(name) as Promise<T>;
}
export const loadGeometry = () => load<Geometry>("geometry");
export const loadScenarios = () => load<ScenariosFile>("scenarios");
export const loadEvidence = () => load<Evidence>("evidence");

function useLoaded<T>(loader: () => Promise<T>): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let on = true;
    loader().then((x) => on && setV(x)).catch((e) => console.error(e));
    return () => { on = false; };
  }, []);
  return v;
}
export const useGeometry = () => useLoaded(loadGeometry);
export const useScenarios = () => useLoaded(loadScenarios);
export const useEvidence = () => useLoaded(loadEvidence);
