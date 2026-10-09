import { useEffect, useState } from "react";
import { Counter, Reveal, Stamp } from "../components/ui";
import { useEvidence, useGeometry, useScenarios } from "../lib/data";
import { Part1 } from "./evidence/Part1";
import { Part2 } from "./evidence/Part2";
import "../styles/evidence.css";

const TOC = [
  { part: "Part I · The Round 1 brief", items: [["problem", "1 Problem discovery"], ["validation", "2 Problem validation"], ["gap", "3 Existing solutions and gap"], ["solution", "4 Proposed solution"], ["innovation", "5 Innovation"], ["declaration", "6 AI usage declaration"], ["sources", "7 Sources"]] },
  { part: "Part II · The build", items: [["ingestion", "8 Data ingested"], ["profile", "9 Before any flood"], ["network", "10 Data quality"], ["exposure", "11 Exposure"], ["method", "12 Method and formulas"], ["results", "13 Results"], ["robustness", "14 Robustness"], ["limits", "15 Limitations"]] },
];
const IDS = TOC.flatMap((g) => g.items.map((i) => i[0]));

function jump(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.__lenis) window.__lenis.scrollTo(el, { offset: -72, duration: 1.2 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function useSpy() {
  const [on, setOn] = useState(IDS[0]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      let cur = IDS[0];
      for (const id of IDS) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < innerHeight * 0.34) cur = id; }
      setOn(cur);
    };
    const h = () => { if (!raf) raf = requestAnimationFrame(tick); };
    addEventListener("scroll", h, { passive: true }); h();
    return () => { removeEventListener("scroll", h); cancelAnimationFrame(raf); };
  }, []);
  return on;
}

export default function Evidence() {
  const geo = useGeometry(), sc = useScenarios(), ev = useEvidence();
  const on = useSpy();
  const ready = geo && sc && ev;
  return (
    <main className="page ev">
      <header className="ev__hero wrap">
        <div className="eyebrow"><b>Commit for Good 2026</b> · Round 1 brief, with the Round 2 build</div>
        <h1 className="ev__title display">Flood-Ready Access: <i className="italic">anticipating the loss of road access to health facilities during floods in Cachar, Assam</i></h1>
        <div className="ev__by mono">Team Kernel Panic · 9 October 2026 · Domain: AI for Resilient and Sustainable Supply Chains · MIT licence</div>
        <div className="ev__abs">
          <p><b>Abstract.</b> When floods cut roads and disable clinics in Assam, the flow of medicines and patients is interrupted at the moment demand for care rises, yet district officers allocate scarce vehicles and stock only after access has been lost. We propose a decision-support system that simulates flood-driven failure of roads and health facilities on a district road network, measures the resulting loss of access for every village, and allocates limited stock and vehicles accordingly. Using open Government of India data for Cachar district, we reconstruct a network of <b>1,188</b> villages, <b>1.62 million</b> residents, <b>3,525 km</b> of road and <b>87</b> health facilities; show that a 10 m endpoint-snapping rule connects <b>90.4%</b> of road segments and places <b>88.0%</b> of residents within 500 m of a single network; and show that simulated floods remove on average <b>7.8%</b>, <b>24.4%</b> and <b>43.9%</b> of road length at three severity levels. Stock levels and flood extents are generated, so the results illustrate the method, not a measured outcome.</p>
          <p className="ev__abs2"><b>Since the brief (Round 2).</b> We built the routable network (98.7% of segments joined), the access-loss assessment, five allocation methods compared over 60 generated floods with confidence intervals, three pre-positioned hubs tested out of sample, sensitivity and robustness checks, and an interactive calculator. The main findings are in <a href="#results" onClick={(e) => { e.preventDefault(); jump("results"); }}>section 13</a>; the same claim stands: these are results of a method on generated floods and stock.</p>
        </div>
        <div className="ev__kpis">
          {[{ v: 1.62, d: 2, s: " M", l: "residents in 1,188 villages (Cachar)" }, { v: 3525, d: 0, s: " km", l: "road network, 1,136 segments" }, { v: 87, d: 0, s: "", l: "human-health facilities" }, { v: 88, d: 1, s: "%", l: "of residents within 500 m of the main network" }, { v: 43.9, d: 1, s: "%", l: "mean road length cut by a severe simulated flood", hot: true }].map((k) => (
            <div key={k.l} className={`kpi ${k.hot ? "kpi--hot" : ""}`}><Counter className="kpi__v display" value={k.v} decimals={k.d} suffix={k.s} /><div className="kpi__l">{k.l}</div></div>
          ))}
        </div>
        <Reveal><div className="ev__legend"><Stamp kind="real" /> official open data <Stamp kind="gen" /> generated and declared (seed 42) <Stamp kind="calc" /> computed from the two <Stamp kind="sec" /> secondary source, to be verified</div></Reveal>
      </header>

      <div className="wrap ev__grid">
        <aside className="ev__toc" aria-label="Sections">
          {TOC.map((g) => (
            <div key={g.part}>
              <div className="eyebrow">{g.part}</div>
              <ul>{g.items.map(([id, label]) => <li key={id}><a href={`#${id}`} className={on === id ? "on" : ""} onClick={(e) => { e.preventDefault(); jump(id); }}>{label}</a></li>)}</ul>
            </div>
          ))}
        </aside>
        <article className="ev__main">
          {ready ? (<><Part1 geo={geo!} sc={sc!} ev={ev!} /><Part2 geo={geo!} ev={ev!} /></>) : <div className="skel" style={{ height: 600 }} />}
        </article>
      </div>
    </main>
  );
}
