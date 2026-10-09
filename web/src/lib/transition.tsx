import { animate } from "motion";
import { MouseEvent, ReactNode, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { create } from "zustand";

/* A cinematic curtain between pages: an ink panel wipes up, the route changes underneath, the panel lifts away. */
interface CurtainState { label: string; el: HTMLDivElement | null; busy: boolean; set: (p: Partial<CurtainState>) => void }
export const useCurtain = create<CurtainState>((set) => ({ label: "", el: null, busy: false, set: (p) => set(p) }));

const LABELS: Record<string, string> = { "/": "Kernel Panic", "/evidence": "The evidence", "/calculator": "The calculator" };
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToId(hash?: string) {
  const el = hash ? document.getElementById(hash) : null;
  if (window.__lenis) window.__lenis.scrollTo(el ?? 0, { offset: el ? -72 : 0, duration: 1.3 });
  else if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

export function useGo() {
  const navigate = useNavigate();
  const loc = useLocation();
  return async (to: string) => {
    const { el, busy, set } = useCurtain.getState();
    const [path, hash] = to.split("#");
    if (busy) return;
    if (path === loc.pathname) {   // same page: just scroll
      scrollToId(hash);
      return;
    }
    if (!el || reduced()) { navigate(to); return; }
    set({ busy: true, label: LABELS[path] ?? "" });
    el.classList.add("on");
    await animate(el, { transform: ["translateY(101%)", "translateY(0%)"] }, { duration: 0.6, ease: [0.76, 0, 0.24, 1] });
    navigate(to);
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 380));
    await animate(el, { transform: ["translateY(0%)", "translateY(-101%)"] }, { duration: 0.6, ease: [0.76, 0, 0.24, 1] });
    el.classList.remove("on");
    el.style.transform = "translateY(101%)";
    set({ busy: false });
    if (hash) setTimeout(() => scrollToId(hash), 160);
  };
}

export function Curtain() {
  const ref = useRef<HTMLDivElement>(null);
  const label = useCurtain((s) => s.label);
  useEffect(() => { useCurtain.getState().set({ el: ref.current }); }, []);
  return (
    <div ref={ref} className="curtain" aria-hidden>
      <div className="curtain__label">{label}<i className="cursor" /></div>
    </div>
  );
}

export function TLink({ to, children, className, onClick, ...rest }: { to: string; children: ReactNode; className?: string; onClick?: () => void } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const go = useGo();
  return (
    <a href={to} className={className} {...rest}
       onClick={(e: MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onClick?.(); go(to); }}>
      {children}
    </a>
  );
}
