import { motion, useMotionValueEvent, useScroll, useTransform, MotionValue } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Counter, Reveal, Stamp } from "../components/ui";
import { MapCanvas } from "../components/map/MapCanvas";
import { useGeometry, useScenarios } from "../lib/data";
import { TLink } from "../lib/transition";
import "../styles/landing.css";

const REPO = "https://github.com/chiragshah2357/Commit-for-Good---Kernel-Panic";

/** Piecewise-linear map of scroll progress, evaluated in JS (the native scroll-timeline path drifted in some browsers). */
function useLin(p: MotionValue<number>, xs: number[], ys: number[]) {
  return useTransform(p, (v) => {
    if (v <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (v <= xs[i]) { const t = (v - xs[i - 1]) / (xs[i] - xs[i - 1] || 1); return ys[i - 1] + (ys[i] - ys[i - 1]) * t; }
    return ys[ys.length - 1];
  });
}

/** A number inside the pinned hero that follows scroll progress without re-rendering React. */
function HudNumber({ p, from, to, value, fmt }: { p: MotionValue<number>; from: number; to: number; value: number; fmt: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useMotionValueEvent(p, "change", (v) => {
    const t = Math.min(Math.max((v - from) / (to - from), 0), 1), e = 1 - Math.pow(1 - t, 2.2);
    if (ref.current) ref.current.textContent = fmt(value * e);
  });
  return <span ref={ref}>{fmt(0)}</span>;
}

function Beat({ p, a, b, children, className }: { p: MotionValue<number>; a: number; b: number; children: React.ReactNode; className?: string }) {
  const fade = 0.035;
  const last = b >= 1;
  const input = last ? [a - fade, a, 1] : [a - fade, a, b, b + fade];
  const opacity = useLin(p, input, last ? [0, 1, 1] : [0, 1, 1, 0]);
  const y = useLin(p, input, last ? [22, 0, 0] : [22, 0, 0, -22]);
  return <motion.div className={`beat ${className ?? ""}`} style={{ opacity, y }}>{children}</motion.div>;
}

function Hero() {
  const geo = useGeometry(), sc = useScenarios();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [reveal, setReveal] = useState(0);
  const [mode, setMode] = useState<"neutral" | "status">("neutral");
  useMotionValueEvent(p, "change", (v) => {
    setReveal(Math.round(Math.min(Math.max((v - 0.3) / 0.32, 0), 1) * 48) / 48);
    setMode(v > 0.66 ? "status" : "neutral");
  });
  const preset = sc?.presets.find((x) => x.name === "severe_11");
  const order = useMemo(() => {
    if (!geo || !preset) return [];
    const lon = new Map(geo.roads.map((r) => [r.id, r.p[0][0]]));
    return [...preset.cut].sort((a, b) => (lon.get(a) ?? 0) - (lon.get(b) ?? 0));
  }, [geo, preset]);
  const cut = useMemo(() => new Set(order), [order]);
  const out = useMemo(() => new Set(preset?.out ?? []), [preset]);
  const h = sc?.hero;
  const scale = useLin(p, [0, 0.13], [1, 0.27]);
  const ledeO = useLin(p, [0, 0.07], [1, 0]);
  const hudO = useLin(p, [0.25, 0.32], [0, 1]);
  const barW = useTransform(p, (v) => `${Math.min(Math.max(v, 0), 1) * 100}%`);

  return (
    <section className="hero" ref={ref} aria-label="Introduction">
      <div className="hero__stick">
        <div className="hero__map" aria-hidden>
          {geo && h ? (
            <MapCanvas geo={geo} cut={cut} cutOrder={order} cutReveal={reveal} villageMode={mode} villageStatus={h.status} facilityOut={reveal > 0.9 ? out : undefined}
                       layers={{ routes: false, hubs: false }} padding={26} />
          ) : <div className="skel" style={{ width: "100%", height: "100%" }} />}
        </div>

        <div className="hero__type wrap">
          <div className="hero__eyebrow eyebrow">
            <b>Commit for Good 2026</b> · Round 2 · AI for resilient and sustainable supply chains
          </div>
          <motion.h1 className="wordmark display" style={{ scale, transformOrigin: "0 0" }}>
            <span>KERNEL</span>
            <span>PANIC<i className="cursor" /></span>
          </motion.h1>
          <div className="hero__lede">
            <motion.p className="lede" style={{ opacity: ledeO, margin: 0 }}>
              Flood-Ready Access. When the water cuts the roads of Cachar, which villages lose their way to a clinic, and what should be sent where?
            </motion.p>
          </div>

          <div className="hero__beats">
            <Beat p={p} a={0.16} b={0.27}>
              <div className="eyebrow">Cachar district, Assam <Stamp kind="real" /></div>
              <p className="beat__big display"><b>1,188</b> villages. <b>3,525</b> km of road. <b>87</b> clinics.</p>
              <p className="beat__sm">Official open data (PMGSY GeoSadak), joined into one routable network.</p>
            </Beat>
            <Beat p={p} a={0.3} b={0.63}>
              <div className="eyebrow">One severe flood <Stamp kind="gen" /></div>
              <p className="beat__big display">The water rises. <i className="italic">Roads go under.</i></p>
              <p className="beat__sm">A simulated flood from real rivers and terrain, seed 42. Not a historical event.</p>
            </Beat>
            <Beat p={p} a={0.66} b={0.87}>
              <div className="eyebrow">Who loses care first <Stamp kind="calc" /></div>
              <p className="beat__big display"><b>{h ? Math.round(h.access.pop_cut_off).toLocaleString("en-US") : "715,833"}</b> residents have no road to a working clinic.</p>
              <p className="beat__sm">Teal: still connected. Amber: 30+ minutes slower. Red: cut off.</p>
            </Beat>
            <Beat p={p} a={0.9} b={1} className="beat--final">
              <p className="beat__big display">Who loses care first, <i className="italic">and what should be sent where?</i></p>
              <div className="hero__cta">
                <TLink to="/calculator" className="btn">Open the calculator <span className="arr">{"→"}</span></TLink>
                <TLink to="/evidence" className="btn btn--ghost">Read the evidence</TLink>
              </div>
            </Beat>
          </div>
        </div>

        {h && (
          <motion.div className="hero__hud" style={{ opacity: hudO }}>
            <div><span className="eyebrow">Road cut</span><b className="mono"><HudNumber p={p} from={0.3} to={0.62} value={(h.scenario_block.share_road_cut as number) * 100} fmt={(n) => `${n.toFixed(0)}%`} /></b></div>
            <div><span className="eyebrow">Facilities out</span><b className="mono"><HudNumber p={p} from={0.5} to={0.64} value={h.scenario_block.facilities_out as number} fmt={(n) => `${Math.round(n)} / 87`} /></b></div>
            <div><span className="eyebrow">Residents cut off</span><b className="mono"><HudNumber p={p} from={0.66} to={0.84} value={h.access.pop_cut_off} fmt={(n) => Math.round(n).toLocaleString("en-US")} /></b></div>
            <div className="hud__note mono">severe_11 · generated · 4 trucks · 3 hubs</div>
          </motion.div>
        )}
        <div className="hero__scroll mono"><span>Scroll</span><i /></div>
        <motion.div className="hero__prog" style={{ width: barW }} />
      </div>
    </section>
  );
}

const STAGES = [
  { n: "01", t: "Open-data ingestion", d: "Roads, villages with population, health facilities, rivers, terrain, all from public sources.", k: "real" as const },
  { n: "02", t: "Network reconstruction", d: "The published roads were 211 loose fragments. Lines are split at junctions and endpoints snapped within 10 m into one routable graph.", k: "real" as const },
  { n: "03", t: "Flood scenarios", d: "Roads and facilities near rivers and below a flood height are removed: 60 floods at three severities, plus any flood you define.", k: "gen" as const },
  { n: "04", t: "Access-loss assessment", d: "Shortest-path time from every village to its nearest working facility, before and after. Cut off, delayed, or fine.", k: "calc" as const },
  { n: "05", t: "Allocation and explanation", d: "Five ways to split a depot stock across trucks and facilities, compared on the damaged network, with the reason for each pick.", k: "gen" as const },
];

function Pipeline() {
  const [on, setOn] = useState(3);
  return (
    <div className="pipe">
      {STAGES.map((s, i) => (
        <button key={s.n} className={`pipe__st ${on === i ? "on" : ""}`} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} onClick={() => setOn(i)}>
          <span className="pipe__n mono">{s.n}</span>
          <span className="pipe__t display">{s.t}</span>
          <span className="pipe__d">{s.d}</span>
          <span className="pipe__k"><Stamp kind={s.k} /></span>
        </button>
      ))}
    </div>
  );
}

function Finding({ n, title, children, stat, unit, tag }: { n: string; title: string; children: React.ReactNode; stat: React.ReactNode; unit: string; tag: React.ReactNode }) {
  return (
    <Reveal className="find">
      <div className="find__n mono">{n}</div>
      <h3 className="find__t display">{title}</h3>
      <div className="find__stat display">{stat}</div>
      <div className="find__unit eyebrow">{unit}</div>
      <p className="find__p">{children}</p>
      <div>{tag}</div>
    </Reveal>
  );
}

function Pair({ a, b, la, lb, max, suffix = "" }: { a: number; b: number; la: string; lb: string; max: number; suffix?: string }) {
  const w = (v: number) => Math.max((v / max) * 230, 2);
  return (
    <svg viewBox="0 0 320 78" className="pair" role="img" aria-label={`${la}: ${a}${suffix}. ${lb}: ${b}${suffix}`}>
      <text x="0" y="10" className="pair__l">{la}</text>
      <rect x="0" y="15" width={w(a)} height="16" fill="#9c9486" />
      <text x={w(a) + 8} y="28" className="pair__v">{a.toLocaleString("en-US")}{suffix}</text>
      <text x="0" y="48" className="pair__l">{lb}</text>
      <rect x="0" y="53" width={w(b)} height="16" fill="#1d4e89" />
      <text x={w(b) + 8} y="66" className="pair__v">{b.toLocaleString("en-US")}{suffix}</text>
    </svg>
  );
}

export default function Landing() {
  const sc = useScenarios();
  const h = sc?.hero;
  return (
    <main>
      <Hero />

      <section className="sec wrap" id="problem">
        <div className="sec__head">
          <span className="eyebrow">§ 1 · The problem</span>
          <h2 className="display">Roads fail at the exact moment <i className="italic">demand for care rises.</i></h2>
        </div>
        <div className="prob">
          <Reveal className="prob__quote">
            <blockquote className="display">District health officers in flood-prone districts of Assam cannot anticipate which villages and health facilities will lose road access during a flood. Vehicles and medicine stock are therefore allocated reactively.</blockquote>
          </Reveal>
          <div className="prob__stats">
            {[
              { v: "11 lakh+", t: "people affected across 28 districts, Assam, 3 July 2024", s: "Press report; ASDMA bulletin not yet checked" },
              { v: "7 days", t: "Jalapur primary health centre, Cachar: floodwater stagnant over 40% of the outpatient department, medicines washed away (May 2022)", s: "Field report" },
              { v: "28.3%", t: "of Assam's land inundated at least once, 1998 to 2007", s: "NRSC atlas, via India Water Portal" },
            ].map((x, i) => (
              <Reveal key={x.v} delay={i * 0.08} className="stat">
                <div className="stat__v display">{x.v}</div>
                <div className="stat__t">{x.t}</div>
                <Stamp kind="sec">{x.s}</Stamp>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal><p className="foot-note">Press and abstract-level figures are secondary evidence and will be checked against primary ASDMA and NHM documents. Full table with sources: <TLink to="/evidence#validation">Evidence, section 2</TLink>.</p></Reveal>
      </section>

      <section className="sec sec--dark" id="how">
        <div className="wrap">
          <div className="sec__head">
            <span className="eyebrow">§ 2 · What we built</span>
            <h2 className="display">From a flood scenario to <i className="italic">a delivery plan,</i> in five stages.</h2>
          </div>
          <Pipeline />
          <p className="foot-note foot-note--lt">Teal-bordered stages use real open data. Amber stages depend on generated inputs (flood extent, stock, fleet).</p>
        </div>
      </section>

      <section className="sec wrap" id="findings">
        <div className="sec__head">
          <span className="eyebrow">§ 3 · What it found</span>
          <h2 className="display">Three results, <i className="italic">from 60 simulated floods.</i></h2>
        </div>
        <div className="finds">
          <Finding n="A" title="Information is the main gain" stat={<><Counter value={2296} /><small> fewer unmet units</small></>} unit="Informed vs blind nearest-first · mean of 60 floods · 95% CI 2,035 to 2,561"
                   tag={<Stamp kind="gen">Generated floods</Stamp>}>
            Knowing who each facility serves <em>after</em> the flood does the work. In the demo flood, blind nearest-first leaves {h ? Math.round(h.policies.nearest_first.unmet_units).toLocaleString("en-US") : "6,455"} units unmet and informed leaves {h ? Math.round(h.policies.nearest_first_post.unmet_units).toLocaleString("en-US") : "5,103"}. The informed version wins in every one of the 60 floods.
            <Pair a={h ? Math.round(h.policies.nearest_first.unmet_units) : 6455} b={h ? Math.round(h.policies.nearest_first_post.unmet_units) : 5103} la="blind nearest-first (units unmet)" lb="informed nearest-first" max={7200} />
          </Finding>
          <Finding n="B" title="One depot is the weak point" stat={<><Counter value={67} suffix="%" /><small> vs </small><Counter value={10} suffix="%" /></>} unit="Floods leaving under half of facilities reachable · single depot vs three hubs · 30 held-out floods"
                   tag={<Stamp kind="gen">Generated floods</Stamp>}>
            A single store at Silchar is cut off from most facilities in two thirds of unseen floods. Three pre-positioned hubs, chosen on 30 floods and tested on the other 30, reach 72% of facilities instead of 45%.
            <Pair a={67} b={10} la="single depot: floods leaving it isolated" lb="three hubs" max={75} suffix="%" />
          </Finding>
          <Finding n="C" title="Most of what is left is unreachable by road" stat={<><Counter value={20043} /><small> units</small></>} unit="Demand inside cut-off villages · demo flood severe_11 · no truck can deliver it"
                   tag={<Stamp kind="calc">Computed</Stamp>}>
            After the best plan, the unmet demand that remains sits behind severed roads. That is the case for stock held at the facilities themselves, and for boats and other non-road access.
          </Finding>
        </div>
      </section>

      <section className="sec sec--try wrap" id="try">
        <Reveal>
          <div className="try">
            <div>
              <span className="eyebrow">§ 4 · Try it</span>
              <h2 className="display">Cut a bridge. <i className="italic">Watch who loses care.</i></h2>
              <p className="lede">Pick any of 60 floods, draw your own by clicking roads, or raise the river. The engine reruns shortest paths and the allocation live, then scores the result.</p>
              <TLink to="/calculator" className="btn btn--flood">Open the calculator <span className="arr">{"→"}</span></TLink>
            </div>
            <ul className="try__list">
              <li><b>Click-to-cut</b> any road segment and see the villages behind it go dark.</li>
              <li><b>Move the hubs</b> and watch the reach of stock change.</li>
              <li><b>Compare five methods</b> with confidence intervals across all 60 floods.</li>
              <li><b>Find which road to repair first</b>, ranked by residents who regain access.</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="sec wrap" id="team">
        <div className="sec__head">
          <span className="eyebrow">§ 5 · Team</span>
          <h2 className="display">Team <i className="italic">Kernel Panic.</i></h2>
        </div>
        <div className="team">
          <Reveal className="person"><div className="person__n display">Chirag</div><a className="mono" href="https://github.com/chiragshah2357" target="_blank" rel="noreferrer">@chiragshah2357</a></Reveal>
          <Reveal className="person" delay={0.08}><div className="person__n display">Augustya</div><a className="mono" href="https://github.com/AugustyaSingh" target="_blank" rel="noreferrer">@AugustyaSingh</a></Reveal>
          <Reveal className="team__txt" delay={0.16}>
            <p>Built for COMMIT FOR GOOD 2026. The problem was chosen by the team; the data was pulled from national open sources; the code and this interface were written with Claude (Anthropic). The AI usage declaration, with what the team did and what the tool did, is in <TLink to="/evidence#declaration">the evidence, section 6</TLink>.</p>
            <p><a className="btn btn--ghost btn--sm" href={REPO} target="_blank" rel="noreferrer">Source on GitHub <span className="arr">{"↗"}</span></a></p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
