import { ReactNode, useCallback, useState } from "react";
import { ScaleBand, ScaleLinear } from "d3";
import { useMeasure } from "../ui";

export interface Margin { t: number; r: number; b: number; l: number }
export const M0: Margin = { t: 16, r: 16, b: 38, l: 48 };

/** Responsive SVG: measures its container, hands the drawing code an inner width and height. */
export function Chart({ height = 260, margin = M0, children, label, className }: { height?: number; margin?: Margin; children: (w: number, h: number) => ReactNode; label: string; className?: string }) {
  const [ref, W] = useMeasure<HTMLDivElement>();
  const w = Math.max(W - margin.l - margin.r, 40), h = height - margin.t - margin.b;
  return (
    <div ref={ref} className={`chart-wrap ${className ?? ""}`} style={{ width: "100%", position: "relative" }}>
      {W > 0 && (
        <svg className="chart" width={W} height={height} role="img" aria-label={label}>
          <g transform={`translate(${margin.l},${margin.t})`}>{children(w, h)}</g>
        </svg>
      )}
    </div>
  );
}

export function AxisBottom({ scale, h, ticks, format, label }: { scale: ScaleLinear<number, number> | ScaleBand<string>; h: number; ticks?: number | string[]; format?: (v: any) => string; label?: string }) {
  const isBand = "bandwidth" in scale;
  const vals: any[] = isBand ? (ticks as string[] | undefined) ?? scale.domain() : scale.ticks(typeof ticks === "number" ? ticks : 6);
  const x = (v: any) => (isBand ? (scale as ScaleBand<string>)(v)! + (scale as ScaleBand<string>).bandwidth() / 2 : (scale as ScaleLinear<number, number>)(v));
  const [r0, r1] = scale.range();
  return (
    <g className="axis" transform={`translate(0,${h})`}>
      <path d={`M${r0},0H${r1}`} />
      {vals.map((v) => <g key={String(v)} transform={`translate(${x(v)},0)`}><line y2="5" /><text y="18" textAnchor="middle">{format ? format(v) : String(v)}</text></g>)}
      {label && <text x={(r0 + r1) / 2} y="34" textAnchor="middle" className="lbl" style={{ fontWeight: 500 }}>{label}</text>}
    </g>
  );
}

export function AxisLeft({ scale, w, ticks = 5, format, label, grid = true }: { scale: ScaleLinear<number, number>; w: number; ticks?: number; format?: (v: number) => string; label?: string; grid?: boolean }) {
  const [r1, r0] = scale.range();
  return (
    <g className="axis">
      {grid && <g className="grid">{scale.ticks(ticks).map((v) => <line key={v} x1="0" x2={w} y1={scale(v)} y2={scale(v)} />)}</g>}
      <path d={`M0,${r0}V${r1}`} />
      {scale.ticks(ticks).map((v) => <g key={v} transform={`translate(0,${scale(v)})`}><line x2="-5" /><text x="-9" dy="0.32em" textAnchor="end">{format ? format(v) : String(v)}</text></g>)}
      {label && <text transform={`translate(${-38},${(r0 + r1) / 2}) rotate(-90)`} textAnchor="middle" style={{ fontWeight: 500 }}>{label}</text>}
    </g>
  );
}

/** Hover tooltip: positioned in the viewport, so any chart can use it. */
export function useTip<T>() {
  const [tip, setTip] = useState<{ x: number; y: number; d: T } | null>(null);
  const show = useCallback((e: React.MouseEvent, d: T) => setTip({ x: e.clientX, y: e.clientY, d }), []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

export function Tip({ tip, children }: { tip: { x: number; y: number } | null; children: ReactNode; w?: number }) {
  if (!tip) return null;
  return <div className="chart-tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 230), top: Math.max(tip.y - 14, 4) }}>{children}</div>;
}
