import { ReactNode } from "react";
import { Figure, Reveal, Stamp } from "../../components/ui";
import { fmt, pct } from "../../lib/format";
import type { Evidence, Geometry } from "../../lib/types";
import { AccessCdf, BaselineMap, CatchmentsStock, FacilityCleaning, NetworkAudit, RoadCategories, VillageSizes, VulnerabilityMap, VulnTables } from "./figs2";
import { FloodImpact, HubResilience, InfoVsOpt, MethodTable, PairedTable, Robustness, Sensitivity, UnmetByPolicy, ValidationChecks } from "./figs3";
import { P, Sec, Sub } from "./Part1";

const N = ({ children }: { children: ReactNode }) => <b className="n">{children}</b>;
const Eq = ({ n, children }: { n: string; children: ReactNode }) => <Reveal><div className="eq"><span className="eq__n mono">({n})</span><div className="eq__b">{children}</div></div></Reveal>;
const Where = ({ children }: { children: ReactNode }) => <p className="eq__w">{children}</p>;

export function Part2({ geo, ev }: { geo: Geometry; ev: Evidence }) {
  const p = ev.profile, a = p.access_before_flood;
  return (
    <>
      <div className="ev__part" id="build">
        <Reveal><div className="eyebrow">Part II</div><h2 className="display">What we built in Round 2, <i className="italic">and what it found</i></h2>
          <p className="lede">Everything below is computed by the code in the repository from the data it ships with, and every figure can be reproduced with <span className="mono">python -m floodready profile, evaluate, report, export</span>. Floods, stock, the depot and the fleet are generated, so these are results of a method under stated assumptions.</p></Reveal>
      </div>

      <Sec id="ingestion" no="§ 8" title={<>The data we ingested, <i className="italic">and how we cleaned it</i></>}>
        <P>We started from the PMGSY Rural Connectivity Datasets for Cachar (district id 97): <N>{fmt(p.ingestion.villages)}</N> habitations with population, <N>{fmt(p.ingestion.road_segments)}</N> road segments, and a facility layer in four categories. Only the 'Medical' category is relevant, and it contains animal hospitals: <N>{p.ingestion.veterinary_removed}</N> of its <N>{p.ingestion.medical_raw}</N> entries are veterinary and were removed by name, leaving <N>{p.ingestion.human_health_facilities}</N> human-health facilities.</P>
        <Figure n="L1" title="Cleaning the facility layer" stamps={["real"]} caption={`119 'Medical' entries, 32 of them veterinary (animal hospitals, livestock and poultry units) and removed by name pattern; 87 human-health facilities kept. Other categories (transport, education, agriculture) are not health facilities.`}>
          <FacilityCleaning ev={ev} />
        </Figure>
      </Sec>

      <Sec id="profile" no="§ 9" title={<>The district <i className="italic">before any flood</i></>}>
        <P>Cachar has <N>{fmt(p.ingestion.residents)}</N> residents in <N>{fmt(p.ingestion.villages)}</N> villages (median {fmt(p.villages.median_residents)}) and <N>{fmt(p.ingestion.road_km)} km</N> of road, mostly village roads. That is <N>{p.facilities.per_100k_residents.toFixed(1)}</N> facilities per 100,000 residents. {pct(p.villages.residents_in_villages_over_3000_share)} of residents live in the {p.villages.villages_over_3000} villages with over 3,000 people.</P>
        <div className="ev__pair">
          <Figure n="L2" title="Village sizes" stamps={["real"]} caption="Most villages hold 300 to 3,000 people; a few very large ones hold a large share of residents."><VillageSizes ev={ev} /></Figure>
          <Figure n="L3" title="Road kilometres by category" stamps={["real"]} caption="Village roads (RR(VR)) dominate, which matters: they are the first to go under and carry the lowest assumed speeds."><RoadCategories ev={ev} /></Figure>
        </div>
        <P>Before any flood, the median resident is <N>{a.median_min.toFixed(0)} min</N> from the nearest facility and the 90th percentile <N>{a.p90_min.toFixed(0)} min</N>; <N>{fmt(a.residents_over_30_min)}</N> residents already live more than 30 minutes away, and <N>{fmt(a.unconnected_residents)}</N> sit in villages the road data does not connect to any facility (reported separately, never counted as flood damage).</P>
        <Figure n="L4" title="Travel time to the nearest facility, before any flood" stamps={["real", "calc"]} caption="Share of residents within each travel time, on the reconstructed network with assumed speeds by road class. The shaded region marks the 30-minute threshold used for 'delayed'."><AccessCdf ev={ev} /></Figure>
        <Figure n="L7" title="Baseline access: who is far from care before any flood" stamps={["real", "calc"]} caption="Each village coloured by minutes to its nearest facility (capped at 45). Grey villages are not connected to any facility in the road data. Use Pan and zoom to explore."><BaselineMap geo={geo} ev={ev} /></Figure>
      </Sec>

      <Sec id="network" no="§ 10" title={<>Data quality: <i className="italic">211 fragments into one network</i></>}>
        <P>The published road lines are not topologically joined. We split every line where it crosses another or where another line's endpoint lies within the tolerance, merge piece endpoints within <N>10 m</N> into one node, and keep each edge's original segment id so that flood scenarios, which cut whole segments, can be applied by id. The result is a graph of <N>{fmt(p.network.nodes)}</N> nodes and <N>{fmt(p.network.edges)}</N> edges in which <N>{pct(p.network.segments_in_main_share_at_10m, 1)}</N> of segments lie in one network and 87 of 87 facilities attach.</P>
        <Figure n="L5" title="The published roads are not joined; splitting and 10 m snapping fixes it" stamps={["real", "calc"]} caption="Left: share of segments and residents in the largest network by snapping tolerance, after splitting lines at junctions. Right: pieces left over. The chosen 10 m is the knee: beyond it little is gained."><NetworkAudit ev={ev} /></Figure>
        <P>The load on facilities is uneven. A facility serves a median <N>{fmt(p.facilities.median_residents_served)}</N> residents and the busiest serves <N>{fmt(p.facilities.max_residents_served)}</N>; <N>{p.facilities.over_30k_residents}</N> serve over 30,000 and <N>{p.facilities.zero_catchment}</N> serve nobody on a travel-time basis, because the generated stock used straight-line catchments. We state this mismatch rather than hide it.</P>
        <Figure n="L6" title="Catchments and stock" stamps={["real", "gen"]} caption="Left: how many residents each facility serves, from real data. Right: days of stock cover, which is generated (lognormal, median 14 days, clipped to 2 to 60); 40 of 87 facilities hold under two weeks."><CatchmentsStock ev={ev} /></Figure>
      </Sec>

      <Sec id="exposure" no="§ 11" title={<>Exposure across <i className="italic">60 simulated floods</i></>}>
        <P>Before choosing any one scenario we ask which villages and which roads are most exposed across all of them. The mean share of residents cut off rises from {pct(ev.validation.share_cut_off_by_severity.mild, 1)} (mild) to {pct(ev.validation.share_cut_off_by_severity.moderate, 1)} (moderate) and {pct(ev.validation.share_cut_off_by_severity.severe, 1)} (severe).</P>
        <Reveal><FloodImpact ev={ev} /><p className="tbl-cap"><b>Table E</b> Flood impact on access (means over 20 generated floods per severity, three hubs). 'Cut off or delayed' counts residents with no route or 30+ extra minutes.</p></Reveal>
        <Figure n="L8" title="Vulnerable connections: where preventive action pays most" stamps={["real", "gen", "calc"]} caption="Villages shaded by the share of the 60 simulated floods that cut them off; black lines are the 10 road segments whose individual loss would cut off the most residents (computed on the real network, independent of the generated floods)."><VulnerabilityMap geo={geo} ev={ev} /></Figure>
        <Reveal><VulnTables ev={ev} /></Reveal>
      </Sec>

      <Sec id="method" no="§ 12" title={<>Method <i className="italic">and formulas</i></>}>
        <P>All parameters are assumptions, listed with their basis in <span className="mono">datasets/synthetic/ASSUMPTIONS.md</span>. Nothing here is fitted to real outcomes.</P>
        <Sub>12.1 Access loss</Sub>
        <Eq n="1"><code>t(v) = ℓ<sub>v</sub> + min<sub>f ∈ W</sub> d<sub>G</sub>(n<sub>v</sub>, n<sub>f</sub>)</code></Eq>
        <Where>Travel time of village <i>v</i> to the nearest working facility. <i>G</i> is the road graph with the flood's cut segments removed, <i>d<sub>G</sub></i> the shortest-path time (Dijkstra, edge time = length / speed of the road class), <i>W</i> the working facilities, and ℓ<sub>v</sub> the first leg from the village to its nearest node at 10 km/h. Speeds: NH 50, SH 40, MDR 30, RR(ODR) 25, RR(VR) 20, BR 20, RR(TRACK) 10 km/h (assumed).</Where>
        <Eq n="2"><code>cut off: t<sub>before</sub> &lt; ∞ and t<sub>after</sub> = ∞ &nbsp;·&nbsp; delayed: t<sub>after</sub> − t<sub>before</sub> ≥ 30 min &nbsp;·&nbsp; unconnected: t<sub>before</sub> = ∞</code></Eq>
        <Where>Villages already unreachable without a flood are a data gap, not flood damage, so they are reported separately.</Where>
        <Sub>12.2 Demand, shortfall and the allocation programme</Sub>
        <Eq n="3"><code>d<sub>f</sub> = P<sub>f</sub> × 0.002 × H &nbsp;·&nbsp; s<sub>f</sub> = max(d<sub>f</sub> − stock<sub>f</sub>, 0) &nbsp;·&nbsp; u<sub>f</sub> = max(s<sub>f</sub> − q<sub>f</sub>, 0)</code></Eq>
        <Where>P<sub>f</sub> is the residents whose nearest working facility is <i>f</i> after the flood, H = 14 days, q<sub>f</sub> the units delivered. Demand in cut-off villages cannot be delivered by road and is reported separately.</Where>
        <Eq n="4"><code>h<sub>f</sub> = 2·t(hub→f)/60 + 0.5 h &nbsp;·&nbsp; B = trucks × 10 h × 3 days</code></Eq>
        <Eq n="5"><code>max Σ<sub>f</sub> c<sub>f</sub> x<sub>f</sub> &nbsp; s.t. &nbsp; Σ<sub>f</sub> h<sub>f</sub> x<sub>f</sub> ≤ B &nbsp;, &nbsp; Σ<sub>f ∈ hub k</sub> c<sub>f</sub> x<sub>f</sub> ≤ S/|K| &nbsp;, &nbsp; x<sub>f</sub> ∈ {"{0, 1}"}</code></Eq>
        <Where>A facility is visited in one dedicated trip (x<sub>f</sub> = 1) delivering c<sub>f</sub> = min(s<sub>f</sub>, 3,000) units from its nearest reachable hub on the damaged graph. The programme maximises useful units under the truck-hour budget and each hub's share of the depot stock S (10 days of district demand, split equally). It is solved exactly with SciPy's HiGHS mixed-integer solver.</Where>
        <Sub>12.3 The five methods compared</Sub>
        <Reveal><ul className="ev__list">
          <li><b>Do nothing.</b> No delivery.</li>
          <li><b>Proportional.</b> Depot stock split by <em>pre-flood</em> catchment population, nearest facilities first while truck-hours last.</li>
          <li><b>Nearest-first, blind.</b> Fill <em>pre-flood</em> shortfalls, nearest facility first. This is the rule an officer would use without the access analysis.</li>
          <li><b>Nearest-first, informed.</b> The same rule on <em>post-flood</em> shortfalls. This ablation isolates the value of the information the access-loss assessment adds.</li>
          <li><b>Access-aware optimiser.</b> Equation 5, on post-flood shortfalls and travel times: information plus optimisation.</li>
        </ul></Reveal>
        <Sub>12.4 The Resilience Index</Sub>
        <Eq n="6"><code>RI = 100 × (w<sub>A</sub>·A + w<sub>S</sub>·S + w<sub>E</sub>·E + w<sub>R</sub>·R)</code></Eq>
        <Where><b>A</b> access retained: 1 − residents cut off or delayed ÷ connected residents. <b>S</b> supply continuity: 1 − (unmet units + units in cut-off villages) ÷ 14-day demand. <b>E</b> equity: 1 − share of working facilities left more than 25% short. <b>R</b> hub reach: working facilities a hub can still reach by road. Default weights 0.35, 0.35, 0.15, 0.15, adjustable in the calculator. The index is a judgement-weighted summary for comparing options on the same flood; it has not been validated against real outcomes, and the four components are always shown beside it.</Where>
        <Sub>12.5 Statistics</Sub>
        <Reveal><ul className="ev__list">
          <li><b>Confidence intervals</b> are percentile bootstrap intervals (2,000 resamples, seed 42) over floods.</li>
          <li><b>Paired comparison</b> of two methods on the same floods reports the mean difference with its bootstrap interval, the share of floods in which one wins or ties, and a Wilcoxon signed-rank p-value.</li>
          <li><b>CVaR 10%</b> is the mean of the worst 10% of floods (the 6 worst of 60), a tail-risk summary.</li>
          <li><b>Hubs</b> are chosen by greedy cover on 30 training floods (maximise facility-scenario pairs reachable) and judged on the other 30, so the result is out-of-sample.</li>
          <li><b>Repair priority</b> restores each cut segment alone and counts residents who regain access; an exact shortest-path test skips segments that cannot help.</li>
          <li><b>Data-incompleteness band</b> removes a random share of segments from the network, recomputes, and reports the 5th to 95th percentile over repeats.</li>
        </ul></Reveal>
      </Sec>

      <Sec id="results" no="§ 13" title={<>Results: <i className="italic">information first, optimisation when trucks are scarce</i></>}>
        <P>The five methods are compared over the 60 generated floods. Unmet demand counts what remains short at working facilities after delivery, in units over 14 days. All results are on generated floods and stock.</P>
        <Figure n="R1" title="Unmet demand by method, single depot against three hubs" stamps={["gen", "calc"]} caption="Bars are means of 20 floods per severity; whiskers are 95% bootstrap CIs. For the informed methods, three pre-positioned hubs lower unmet demand in every severity; the blind and proportional rules gain less, and proportional does worse with hubs in mild floods. Choose the fleet size above."><UnmetByPolicy ev={ev} /></Figure>
        <Figure n="R2" title="Where the gain comes from" stamps={["gen", "calc"]} caption="The height of each bar is what blind nearest-first leaves unmet. Green is removed by knowing who each facility serves after the flood, blue by optimisation, grey is what remains and is unreachable by road. The optimisation share appears only when trucks are scarce (2 trucks)."><InfoVsOpt ev={ev} /></Figure>
        <Reveal><MethodTable ev={ev} /></Reveal>
        <Reveal><PairedTable ev={ev} /></Reveal>
        <Reveal><div className="callout"><b>Reading Table D.</b> Against blind nearest-first, the optimiser leaves about 2,296 fewer units unmet (95% CI 2,035 to 2,561) and is better in every one of the 60 floods. Against informed nearest-first it ties once there are 4 trucks or more, because the information, not the solver, carries the gain; with 1 truck the optimiser still helps (3,870 against 5,806 units).</div></Reveal>
        <Figure n="R3" title="Pre-positioning stock keeps far more facilities reachable" stamps={["gen", "calc"]} caption="A single depot at Silchar is cut off from most facilities in two thirds of unseen floods. Three hubs, chosen on 30 floods and judged on the other 30, cut that to a tenth and raise the share of facilities reached from 45% to 72%."><HubResilience ev={ev} /></Figure>
        <Figure n="R4" title="Sensitivity: the ordering of methods holds" stamps={["gen", "calc"]} caption="Mean unmet demand over 60 floods (three hubs) as one assumption changes. The ordering of methods is stable; optimisation only separates from informed nearest-first when trucks are scarce."><Sensitivity ev={ev} /></Figure>
      </Sec>

      <Sec id="robustness" no="§ 14" title={<>Robustness and validation: <i className="italic">what holds and what is fragile</i></>}>
        <Figure n="R5" title="The headline barely moves; the exact top-10 list does" stamps={["real", "calc"]} caption="Randomly removing real roads from our data moves the cut-off share by under one percentage point at 20% missing, but the exact list of the ten worst-hit villages overlaps only 57% to 80%. Use the list as a screen, not a ranking to quote."><Robustness ev={ev} /></Figure>
        <Reveal><ValidationChecks ev={ev} /></Reveal>
      </Sec>

      <Sec id="limits" no="§ 15" title={<>Limitations, <i className="italic">and what real deployment would need</i></>}>
        <Reveal><ul className="ev__list">
          <li><b>Generated inputs.</b> Stock, demand, depot, fleet and flood extents are generated. Severity is tuned, not calibrated to a real event. The honest claim is "on a simulated flood with these assumptions, the method reduced unmet demand by X".</li>
          <li><b>Road data.</b> A July 2022 snapshot via a public mirror; speeds are assumed from road class, not measured; 14,405 residents sit in villages the data does not connect.</li>
          <li><b>Flood rule.</b> A road is cut when its midpoint is lower than the flood height above the nearest river point and within a reach of it. This is not hydraulics, and terrain is 30 m-class data resampled to about 150 m.</li>
          <li><b>Allocation.</b> One dedicated trip per facility; no multi-drop vehicle routing; boats are not modelled. Units are abstract treatment courses, not clinical quantities.</li>
          <li><b>Facilities.</b> All 87 are treated as the same kind of service point; tiers are unknown.</li>
          <li><b>With real data</b> we would replace generated stock with district records, generated floods with dated NRSC inundation maps, and verify the secondary evidence in section 2 against primary ASDMA and NHM documents. The pipeline is otherwise unchanged.</li>
        </ul></Reveal>
        <Reveal><div className="ev__end"><Stamp kind="real" /> <Stamp kind="gen" /> <Stamp kind="calc" /> <span>Real data, generated inputs and computed results are marked on every figure.</span></div></Reveal>
      </Sec>
    </>
  );
}
