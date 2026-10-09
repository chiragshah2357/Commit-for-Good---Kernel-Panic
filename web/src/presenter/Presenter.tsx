import { useEffect, useState } from "react";
import { useGo } from "../lib/transition";
import { useCalc } from "../pages/calculator/store";
import { STEPS } from "./steps";
import { usePresenter } from "./store";

const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Guided 5-minute walk-through: arrow keys move through the talk track, the app jumps to the matching page and state. */
export function Presenter() {
  const { active, step, notes, startedAt, goto, toggle, toggleNotes } = usePresenter();
  const go = useGo();
  const [now, setNow] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.shiftKey && (e.key === "P" || e.key === "p")) { e.preventDefault(); toggle(); return; }
      if (!usePresenter.getState().active) return;
      const s = usePresenter.getState().step;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); goto(Math.min(s + 1, STEPS.length - 1)); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goto(Math.max(s - 1, 0)); }
      else if (e.key === "n" || e.key === "N") toggleNotes();
      else if (e.key === "Escape") usePresenter.getState().stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const s = STEPS[step];
    if (s.calc) useCalc.getState().set(s.calc);
    go(s.to + (s.anchor ? `#${s.anchor}` : ""));
  }, [active, step]);

  if (!active) return null;
  const s = STEPS[step];
  const elapsed = Math.max(0, (now || Date.now()) - startedAt) / 1000;
  return (
    <div className="pres" role="region" aria-label="Presenter">
      <div className="pres__bar">
        <div className="pres__time"><b>{fmtT(elapsed)}</b> / {fmtT(s.at)} plan</div>
        <div className="pres__title"><small>Step {step + 1} of {STEPS.length}</small>{s.title}</div>
        <div className="pres__ctl">
          <button onClick={() => goto(Math.max(step - 1, 0))} aria-label="Previous step">{"←"}</button>
          <button onClick={() => goto(Math.min(step + 1, STEPS.length - 1))} aria-label="Next step">{"→"}</button>
          <button className="wide" onClick={toggleNotes}>{notes ? "Hide" : "Notes"}</button>
          <button className="wide" onClick={() => usePresenter.getState().stop()}>End</button>
        </div>
      </div>
      <div className="pres__prog">{STEPS.map((_, i) => <i key={i} className={i < step ? "done" : i === step ? "now" : ""} onClick={() => goto(i)} />)}</div>
      {notes && (
        <div className="pres__notes">
          <div className="pres__say">{s.say}</div>
          <ul className="pres__nums">{s.numbers.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
