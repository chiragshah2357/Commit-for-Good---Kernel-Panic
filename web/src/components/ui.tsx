import { animate, motion, useInView } from "motion/react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { fmt } from "../lib/format";

export type StampKind = "real" | "gen" | "calc" | "sec";
const STAMP_TEXT: Record<StampKind, string> = { real: "Real data", gen: "Generated", calc: "Computed", sec: "Secondary source" };

export function Stamp({ kind, children }: { kind: StampKind; children?: ReactNode }) {
  return <span className={`stamp stamp--${kind}`}>{children ?? STAMP_TEXT[kind]}</span>;
}

export function Reveal({ children, delay = 0, y = 26, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" | "article" }) {
  const M = motion[as] as typeof motion.div;
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -8% 0px" }}
       transition={{ duration: 0.8, delay, ease: [0.22, 0.8, 0.2, 1] }}>
      {children}
    </M>
  );
}

/** Counts up to `value` when scrolled into view (or whenever `value` changes). */
export function Counter({ value, decimals = 0, prefix = "", suffix = "", duration = 1.4, className, live = false }: { value: number; decimals?: number; prefix?: string; suffix?: string; duration?: number; className?: string; live?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: !live, margin: "0px 0px -10% 0px" });
  const [shown, setShown] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    if (!inView) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(value); last.current = value; return; }
    const c = animate(last.current, value, { duration, ease: [0.22, 0.8, 0.2, 1], onUpdate: (v) => { setShown(v); last.current = v; } });
    return () => c.stop();
  }, [value, inView, duration]);
  return <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>{prefix}{fmt(shown, decimals)}{suffix}</span>;
}

export function Figure({ n, title, stamps, caption, children, className }: { n: string; title: string; stamps?: StampKind[]; caption?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Reveal className={`fig ${className ?? ""}`}>
      <figure style={{ margin: 0 }}>
        <div className="fig__head">
          <span className="fig__n">Fig. {n}</span>
          <h3 className="fig__title">{title}</h3>
          <div className="fig__stamps">{stamps?.map((s) => <Stamp key={s} kind={s} />)}</div>
        </div>
        <div className="fig__body">{children}</div>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    </Reveal>
  );
}

export function Legend({ items }: { items: { label: string; color: string; shape?: "sq" | "ci" | "ln" }[] }) {
  return (
    <div className="legend">
      {items.map((i) => <span key={i.label}><i className={i.shape ?? "sq"} style={{ background: i.color }} />{i.label}</span>)}
    </div>
  );
}

export function useMeasure<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
