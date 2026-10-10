import { ReactNode, useState } from "react";
import { Figure, Reveal, Stamp } from "../../components/ui";
import { REFS, TABLE1, TABLE2, TABLE4, TABLE5, EvidenceKind } from "../../content/brief";
import type { Evidence, Geometry, ScenariosFile } from "../../lib/types";
import { Dumbbells, MapPair, QuestionLadder, Schematic, SnapRound1, Spread, Table3 } from "./figs1";

export function Sec({ id, no, title, children }: { id: string; no: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="ev__sec">
      <Reveal className="ev__sh"><span className="eyebrow">{no}</span><h2 className="display">{title}</h2></Reveal>
      {children}
    </section>
  );
}
export const Sub = ({ id, children }: { id?: string; children: ReactNode }) => <h3 id={id} className="ev__sub display">{children}</h3>;
export const P = ({ children }: { children: ReactNode }) => <Reveal className="prose">{children}</Reveal>;
const N = ({ children }: { children: ReactNode }) => <b className="n">{children}</b>;
const Ref = ({ n }: { n: number }) => <sup><a href={`#ref-${n}`}>[{n}]</a></sup>;

const KINDS: { k: EvidenceKind | "all"; label: string }[] = [{ k: "all", label: "All rows" }, { k: "press", label: "Press report" }, { k: "field", label: "Field report" }, { k: "news", label: "News report" }, { k: "abstract", label: "Conference abstract" }, { k: "atlas", label: "NRSC atlas" }];

export function Part1({ geo, sc, ev }: { geo: Geometry; sc: ScenariosFile; ev: Evidence }) {
  const [kind, setKind] = useState<EvidenceKind | "all">("all");
  return (
    <>
      <Sec id="problem" no="§ 1" title="Problem discovery">
        <P><strong>Context.</strong> Assam is highly flood-prone: the National Remote Sensing Centre atlas found about <N>28.3%</N> of the state's land inundated at least once in 1998 to 2007<Ref n={8} /><Ref n={9} />. According to a press report of 3 July 2024 (the State Disaster Management Authority, ASDMA, bulletin behind it is still to be checked), more than <N>11 lakh</N> people in <N>28</N> districts, and <N>2,208</N> villages in 84 revenue circles, were affected<Ref n={1} />. Flooding repeatedly disrupts rural health care in the Barak Valley, where Cachar lies: in May 2022 floodwater stood for <N>seven days</N> across <N>40%</N> of the outpatient department of the Jalapur primary health centre (PHC) in Cachar and washed away medicines<Ref n={3} />.</P>
        <Reveal><blockquote className="ev__quote display"><b>Problem statement.</b> District health officers in flood-prone districts of Assam cannot anticipate which villages and health facilities will lose road access during a flood. Vehicles and medicine stock are therefore allocated reactively, leaving some communities without medicines while others are over-served.</blockquote></Reveal>
        <P><strong>Who is affected.</strong> Three groups bear the consequences: (i) residents of villages that are cut off, especially people who depend on daily medication<Ref n={5} />; (ii) staff and patients of facilities that are themselves flooded: in the Khelua PHC area of Sivasagar, <N>16 of 19</N> sub-health centres were reportedly damaged and stored medicines destroyed<Ref n={2} />; and (iii) the district health and disaster officials who must decide, with incomplete information, where limited vehicles and stock should go. The failure has two components that are seldom modelled together: the loss of road links (edges) and the loss of facilities (nodes).</P>
        <P><strong>Pilot scope.</strong> We study Cachar district: <N>1,188</N> habitations and <N>1,622,303</N> residents (median <N>986</N> per habitation), <N>1,136</N> road segments totalling <N>3,525 km</N>, and <N>87</N> human-health facilities, all derived from official open data (sections 4 and 7).</P>
      </Sec>

      <Sec id="validation" no="§ 2" title="Problem validation">
        <P>Table 1 collects the evidence we located. Each row is labelled with its evidence type, because most of it is secondary. Filter the rows by type to see how thin the strongest claims are.</P>
        <Reveal>
          <div className="mp__ctl">{KINDS.map((x) => <button key={x.k} className="chip" aria-pressed={kind === x.k} onClick={() => setKind(x.k)}>{x.label}</button>)}</div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Indicator</th><th>Finding</th><th>Ref.</th><th>Evidence type</th></tr></thead>
            <tbody>{TABLE1.filter((r) => kind === "all" || r.kind === kind).map((r) => <tr key={r.indicator}><td>{r.indicator}</td><td>{r.finding}</td><td className="mono">{r.ref}</td><td><Stamp kind="sec">{r.type}</Stamp></td></tr>)}</tbody>
          </table></div>
          <p className="tbl-cap"><b>Table 1</b> Evidence that the problem is real and consequential.</p>
        </Reveal>
        <Figure n="V" title="Floods depress use of public facilities and raise illness (one study, secondary evidence)" stamps={["sec"]}
                caption={<>From a conference abstract on boat-based health care in the char/sapori communities of Assam<Ref n={6} />. The abstract synthesises existing reports rather than reporting new fieldwork, so the figures are second-hand. We cite it as direction of effect, not as an estimate for Cachar.</>}>
          <Dumbbells />
        </Figure>
        <P><strong>Interpretation.</strong> The sources indicate that floods act on the health system through three channels: they cut roads, they disable facilities, and they depress use of public services. A June 2022 review by the National Health Mission reports that officials took stock of medicine supplies and judged the flood situation under control<Ref n={4} />, while an August 2026 report describes shortages of medicines for people with chronic conditions in flood-hit areas<Ref n={5} />. These are different floods, so the pair is not a like-for-like comparison. It is consistent with, but does not show, a <em>distribution</em> problem rather than a <em>stock</em> problem; that is the hypothesis the system is designed to test.</P>
        <P><strong>Limits of the evidence.</strong> Several rows rest on press accounts and on an abstract; none is a peer-reviewed estimate. In Round 2 we re-read the cited pages: the press figures match the articles, and the corrections are listed under "Changes since the Round 1 brief". The ASDMA bulletins themselves could not be retrieved and, with National Health Mission records, are still to be checked against primary documents. The absence of facility-level access data in the public domain is itself part of the problem.</P>
      </Sec>

      <Sec id="gap" no="§ 3" title={<>Existing solutions <i className="italic">and the gap</i></>}>
        <Reveal><div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Existing approach</th><th>What it provides</th><th>Limitation</th><th>Ref.</th></tr></thead>
          <tbody>{TABLE2.map((r) => <tr key={r.approach}><td>{r.approach}</td><td>{r.provides}</td><td>{r.limit}</td><td className="mono">{r.ref}</td></tr>)}</tbody>
        </table></div><p className="tbl-cap"><b>Table 2</b> Existing approaches and their limitations.</p></Reveal>
        <P><strong>Gap.</strong> In a structured web search we found no openly available tool that links a flood scenario to village-level loss of access and then to the allocation of limited stock and vehicles. This is a statement about the scope of our search, not proof of absence. Existing products answer <em>where is the water?</em>; none of those we found answers <em>who loses care first, and what should be sent where?</em></P>
        <Figure n="G" title="Each existing product answers a different question" caption="The last row is the question this project answers.">
          <QuestionLadder />
        </Figure>
      </Sec>

      <Sec id="solution" no="§ 4" title={<>Proposed solution</>}>
        <P><strong>Research question.</strong> How much does allocating stock and vehicles according to modelled loss of access reduce unmet demand, relative to population-proportional and nearest-first allocation, and how sensitive is the result to flood severity and data quality? <strong>User.</strong> A district health officer or disaster-management coordinator deciding where to send limited vehicles today.</P>
        <Sub id="system">4.1 System</Sub>
        <P><strong>(1) Open-data ingestion.</strong> Roads, habitations (with population) and facilities from the PMGSY Rural Connectivity Datasets<Ref n={11} /><Ref n={12} />; waterways from OpenStreetMap<Ref n={13} />; terrain from AWS terrain tiles<Ref n={14} />. <strong>(2) Network reconstruction.</strong> The published road lines are not topologically joined: at 1 m tolerance they form <N>211</N> disconnected components. Snapping endpoints within <N>10 m</N> yields one network holding <N>90.4%</N> of segments, with <N>88.0%</N> of residents within 500 m (Fig. 3). <strong>(3) Flood scenarios.</strong> Roads and facilities near rivers and below a flood height above the nearest river are removed; <N>60</N> scenarios are generated (20 at each of three severities, seed 42). <strong>(4) Access-loss assessment.</strong> Shortest-path travel time from each village to the nearest functioning facility is computed before and after the flood; villages are ranked by residents cut off. <strong>(5) Allocation and explanation.</strong> A capacity-constrained assignment distributes a depot stock using trucks of 3,000 units, and returns a ranked delivery plan with the reason for each ranking.</P>
        <Figure n="1" title="The proposed system" stamps={["real", "gen", "calc"]} caption="Teal stages use real open data; amber stages depend on generated inputs (flood extent, stock, fleet); navy is computed from the preceding stages. Hover a stage to focus it.">
          <Schematic />
        </Figure>
        <Figure n="2" title="The reconstructed Cachar network, and one simulated flood" stamps={["real", "gen"]}
                caption={<><b>(a)</b> The reconstructed network from official data: 1,188 villages, 87 health facilities, 3,525 km of road. <b>(b)</b> One simulated flood, here defaulting to the severe flood <span className="mono">severe_11</span>, with 44.1% of road length cut and 15 facilities out of service. Panel (b) is generated, not a historical event. Pick any of the 60 floods above the map; use Pan and zoom to explore.</>}>
          <MapPair geo={geo} sc={sc} />
        </Figure>
        <div className="ev__pair">
          <Figure n="3a" title="Data audit: the road lines are not joined" stamps={["real"]} caption="Snapping at 10 m raises the largest connected network from 18.7% to 90.4% of segments and the residents within 500 m of it from 17.5% to 88.0%. Beyond 10 m the gain is small, so we chose 10 m.">
            <SnapRound1 ev={ev} />
          </Figure>
          <Figure n="3b" title="Simulated damage over 60 floods" stamps={["gen"]} caption="Bars show means; whiskers show minimum to maximum; dots are the 20 floods of each severity. Severity levels are tuned, not calibrated to a real event. Hover for values.">
            <Spread ev={ev} />
          </Figure>
        </div>
        <Reveal><Table3 ev={ev} /><p className="tbl-cap"><b>Table 3</b> Simulated flood outcomes for Cachar (generated scenarios; seed 42). Computed live from the scenario file.</p></Reveal>

        <Sub id="ai">4.2 Where AI is used</Sub>
        <P>(i) <strong>Graph-based simulation</strong> of cascading access loss on the district network; (ii) <strong>combinatorial optimisation</strong> (a capacity-constrained assignment, solved as an integer programme) to allocate scarce stock, evaluated against simple baselines; (iii) <strong>Monte Carlo scenario analysis</strong> with sensitivity tests on severity, stock and fleet size, reported as ranges; and (iv) an <strong>explanation layer</strong> that states why each village or facility is ranked where it is. A learned flood-susceptibility model trained on historical flood-frequency maps is a planned extension, not part of the current prototype.</P>
        <P><strong>Evaluation.</strong> Metrics are unmet demand, time to reach, and number of residents cut off, over all 60 scenarios. <strong>Real versus generated data.</strong> Real: roads, villages, population, facilities, rivers, terrain. Generated and declared (seed 42; assumptions in <span className="mono">datasets/synthetic/ASSUMPTIONS.md</span>): stock, demand, depot, fleet and flood extent. Results on generated data demonstrate a method; they are not a measured outcome.</P>

        <Sub id="plan">4.3 Plan for Round 2, and where we are now</Sub>
        <P><strong>Round 2 deliverables.</strong> A routable network, the access-loss ranking, allocation compared with baselines over all 60 scenarios, a command-line demonstration with a map, and a repository with README and a tagged v1.0 release. Of these, all but the tagged release are built; this website and its API are an addition.</P>
        <Reveal><div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Risk</th><th>Why it matters</th><th>Mitigation planned</th><th>Where we are</th></tr></thead>
          <tbody>{TABLE4.map((r) => <tr key={r.risk}><td>{r.risk}</td><td>{r.why}</td><td>{r.mitigation}</td><td>{r.now}</td></tr>)}</tbody>
        </table></div><p className="tbl-cap"><b>Table 4</b> Principal risks, the Round 1 mitigation, and the Round 2 status.</p></Reveal>
        <Reveal>
          <aside className="ev__changes">
            <div className="eyebrow">Changes since the Round 1 brief</div>
            <ul>
              <li><b>Network.</b> Lines are now split at crossings and T-junctions before snapping; 98.7% of segments join one network (was 90.4% by snapping alone).</li>
              <li><b>Optimiser.</b> The brief named OR-Tools. The build uses SciPy's HiGHS integer programme: one dedicated truck trip per facility inside a 3-day window, a truck-hour budget and per-hub stock. There is no multi-drop vehicle routing yet.</li>
              <li><b>A flaw we found and fixed.</b> The first allocation model let one truck serve many facilities, so fleet size never changed the answer. It was replaced by dedicated trips so that the fleet can bind. Earlier numbers were superseded.</li>
              <li><b>Depot.</b> A single depot at Silchar proved fragile, so we compare it with three pre-positioned hubs chosen on 30 floods and tested on the other 30.</li>
              <li><b>Evidence wording corrected.</b> On re-reading the cited pages: the 3 July 2024 figures come from a press report that does not itself attribute them to an ASDMA bulletin; at Jalapur PHC 40% of the outpatient department, not all of it, stood in water; the medicine-review article reports that officials took stock of supplies, not that stock was adequate, and it dates from 2022 while the shortage report dates from 2026; the char-community abstract is a synthesis of existing reports and its Lakhimpur setting could not be re-confirmed; the 30 lakh island-population figure is not re-verified. Round 1 submission text is unchanged.</li>
            </ul>
          </aside>
        </Reveal>
      </Sec>

      <Sec id="innovation" no="§ 5" title={<>Innovation and <i className="italic">key differentiator</i></>}>
        <Reveal><ul className="ev__list">
          <li><b>From hazard to decision.</b> Hazard maps and bulletins describe floodwater. Our system links a flood scenario to <em>village-level access loss</em> and then to <em>allocation of stock and vehicles</em>, which is the decision a district officer actually faces.</li>
          <li><b>Failure of links and of nodes.</b> Roads and facilities fail together in the model; most access analyses treat only one.</li>
          <li><b>Built entirely on open data, and reproducible.</b> A short rebuild from public sources; generated data is produced with a fixed seed (identical output across runs), flagged per record, and documented with an assumptions table; MIT-licensed.</li>
          <li><b>Transparent evidence standards.</b> Real and generated inputs are separated in every table and figure; claims are phrased as "on a simulated flood with these assumptions"; results are reported as ranges across 60 scenarios, not single runs.</li>
          <li><b>Transferable.</b> The same national dataset structure should permit rerunning the pipeline for other districts (to be verified for each state), giving a reusable open tool rather than a one-off analysis.</li>
        </ul></Reveal>
      </Sec>

      <Sec id="declaration" no="§ 6" title="AI usage declaration">
        <P><strong>Tool.</strong> Claude (Anthropic), used through the Claude desktop application, for ideation, evidence search, data retrieval and processing, analysis code and drafting, and in Round 2 for the code of this project and website. The division of work is set out below.</P>
        <Reveal><div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Activity</th><th>Team Kernel Panic</th><th>AI tool (Claude)</th></tr></thead>
          <tbody>{TABLE5.map((r) => <tr key={r.activity}><td><b>{r.activity}</b></td><td>{r.team}</td><td>{r.ai}</td></tr>)}</tbody>
        </table></div><p className="tbl-cap"><b>Table 5</b> Division of work between the team and the AI tool.</p></Reveal>
        <P><strong>Data provenance.</strong> Road, village and facility data are the Government of India's PMGSY Rural Connectivity Datasets (Ministry of Rural Development, GeoSadak), published under the Government Open Data Licence<Ref n={11} /><Ref n={15} />. The national portal did not respond from the retrieval environment, so the files were obtained from a public community mirror (datameet) of the July 2022 release<Ref n={12} />. Waterways are from OpenStreetMap<Ref n={13} /> and terrain from AWS Open Data terrain tiles<Ref n={14} />.</P>
        <P><strong>AI suggestions rejected or modified.</strong> (1) <em>Rejected after comparison:</em> a mandi price-glut early-warning system (crowded, forecasting-centred); a carbon-footprint data tool for exporters; medicine-expiry redistribution (overlaps the chosen problem); an industrial waste-matching platform and a truck-pooling platform (no open data; evaluation would be entirely synthetic); and a heterogeneous graph neural network for Scope 3 imputation (circular evaluation on generated graphs). The team retained the flood-access problem. (2) <em>Modified:</em> the first generated flood severities cut 43% of road length even at the mildest level, which was judged implausible; parameters were retuned (mild now cuts 7.8%). (3) <em>Modified:</em> press and abstract-level figures are labelled as secondary evidence rather than presented as established fact.</P>
        <P><strong>Verification status.</strong> Secondary-source figures remain to be verified against primary ASDMA and NHM documents. Generated data are declared and documented in the repository.</P>
      </Sec>

      <Sec id="sources" no="§ 7" title="Sources and references">
        <Reveal><ol className="refs">{REFS.map((r) => <li key={r.n} id={`ref-${r.n}`}><span className="mono">[{r.n}]</span><span>{r.text} <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace(/^https?:\/\//, "").slice(0, 70)}{r.url.length > 78 ? "…" : ""}</a></span></li>)}</ol></Reveal>
      </Sec>
    </>
  );
}
