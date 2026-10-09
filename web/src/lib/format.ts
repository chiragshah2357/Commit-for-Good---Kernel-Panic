export const fmt = (n: number | null | undefined, d = 0) =>
  n == null || !Number.isFinite(n) ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtInt = (n: number | null | undefined) => fmt(n, 0);
export const pct = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? "–" : `${(x * 100).toFixed(d)}%`);
export const mins = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? "unreachable" : `${x.toFixed(d)} min`);
export const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(0)}k` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`;
export const signed = (n: number, d = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n), d)}`;
export const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
