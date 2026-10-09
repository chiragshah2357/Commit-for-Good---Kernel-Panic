"""Figures and a metrics summary built from results/*.csv. Run after `evaluate` and `profile`:  python -m floodready report"""
import json
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.lines import Line2D

RESULTS = Path(__file__).resolve().parent.parent / "results"
DATA = Path(__file__).resolve().parent.parent / "datasets"
TEAL, BLUE, AMBER, CORAL, NAVY, GREY, GREEN = "#1F8A8A", "#4C78A8", "#E8A33D", "#E4572E", "#1B2A41", "#B9C0CA", "#5BAA7A"
POL_COLORS = {"none": GREY, "proportional": AMBER, "nearest_first": BLUE, "nearest_first_post": GREEN, "access_opt": TEAL}
POL_LABELS = {"none": "do nothing", "proportional": "proportional", "nearest_first": "nearest-first (blind)",
              "nearest_first_post": "nearest-first (informed)", "access_opt": "access-aware optimiser"}
plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False, "axes.edgecolor": "#555", "axes.titleweight": "bold",
                     "axes.titlesize": 10, "figure.facecolor": "#FAFBFD", "axes.facecolor": "#FAFBFD", "savefig.facecolor": "#FAFBFD", "axes.grid": True,
                     "grid.color": "#E8ECF2", "grid.linewidth": 0.6, "axes.axisbelow": True})
SEV = ["mild", "moderate", "severe"]


def _save(fig, path):
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)


def landing_figures(R: Path, F: Path):
    prof = json.load(open(R / "profile.json"))
    # L1 ingestion: raw facility categories, medical split
    cats = prof["ingestion"]["facility_categories_raw"]
    fig, ax = plt.subplots(figsize=(6.2, 2.6))
    names = list(cats)
    ax.barh(names, [cats[n] for n in names], color=[GREY if n != "Medical" else CORAL for n in names])
    ax.barh(["Medical"], [prof["ingestion"]["human_health_facilities"]], color=TEAL)
    for i, n in enumerate(names):
        ax.text(cats[n] + 6, i, f"{cats[n]}", va="center")
    ax.text(prof["ingestion"]["human_health_facilities"] / 2, names.index("Medical"), f"{prof['ingestion']['human_health_facilities']} human-health", va="center", ha="center", color="white", fontsize=8)
    ax.set_title("Cleaning the facility layer: 119 'Medical' entries, 32 are veterinary and removed")
    ax.set_xlabel("Facilities in Cachar (PMGSY GeoSadak)"); ax.invert_yaxis(); ax.grid(axis="y", visible=False)
    _save(fig, F / "L1_facility_cleaning.png")
    # L2 village sizes
    b = pd.read_csv(R / "profile_village_bands.csv")
    fig, ax = plt.subplots(figsize=(6.2, 2.9))
    ax.bar(b.band, b.villages, color=TEAL)
    for i, (v, r) in enumerate(zip(b.villages, b.residents)):
        ax.text(i, v + 8, f"{v}\n({r/1000:.0f}k people)", ha="center", fontsize=7)
    ax.set_ylim(0, b.villages.max() * 1.25); ax.set_xlabel("Village size (residents)"); ax.set_ylabel("Villages")
    ax.set_title(f"{prof['ingestion']['villages']:,} villages; most hold 300 to 3,000 people (median {prof['villages']['median_residents']:.0f})")
    _save(fig, F / "L2_village_sizes.png")
    # L3 roads
    c = pd.read_csv(R / "profile_road_categories.csv")
    fig, ax = plt.subplots(figsize=(6.2, 2.4))
    ax.barh(c.RoadCatego, c.km, color=BLUE)
    for i, (k, s) in enumerate(zip(c.km, c.segments)):
        ax.text(k + 20, i, f"{k:,.0f} km ({s} segments)", va="center", fontsize=8)
    ax.invert_yaxis(); ax.set_xlim(0, c.km.max() * 1.35); ax.grid(axis="y", visible=False)
    ax.set_title(f"{prof['ingestion']['road_km']:,.0f} km of road, mostly village roads"); ax.set_xlabel("Kilometres")
    _save(fig, F / "L3_road_network.png")
    # L4 access CDF
    cdf = pd.read_csv(R / "profile_access_cdf.csv"); a = prof["access_before_flood"]
    fig, ax = plt.subplots(figsize=(6.2, 2.9))
    ax.plot(cdf.minutes, cdf.residents_within_share * 100, "-o", color=TEAL)
    for m, s in zip(cdf.minutes, cdf.residents_within_share):
        ax.text(m, s * 100 - 7, f"{s*100:.0f}%", ha="center", fontsize=7.5)
    ax.set_ylim(0, 105); ax.set_xlabel("Travel time to the nearest facility (minutes)"); ax.set_ylabel("Residents within reach (%)")
    ax.set_title(f"Before any flood: median {a['median_min']:.0f} min, 90th percentile {a['p90_min']:.0f} min; {a['residents_over_30_min']/1000:.0f}k residents live over 30 min away")
    _save(fig, F / "L4_baseline_access.png")
    # L5 snapping audit
    s = pd.read_csv(R / "profile_snap_audit.csv")
    fig, ax = plt.subplots(1, 2, figsize=(7.2, 2.7))
    ax[0].plot(s.snap_m.astype(str), s.segments_in_main_share * 100, "-o", color=NAVY, label="road segments")
    ax[0].plot(s.snap_m.astype(str), s.residents_attached_share * 100, "-s", color=TEAL, label="residents attached")
    ax[0].axvline(2, color=CORAL, ls="--", lw=0.8); ax[0].set_ylim(0, 105); ax[0].set_xlabel("Snapping tolerance (m)"); ax[0].set_ylabel("In the main network (%)"); ax[0].legend(fontsize=7, frameon=False, loc="lower right")
    ax[0].set_title("Share joined into one network")
    ax[1].bar(s.snap_m.astype(str), s.components, color=BLUE)
    for i, v in enumerate(s.components):
        ax[1].text(i, v + 1, str(v), ha="center", fontsize=8)
    ax[1].set_xlabel("Snapping tolerance (m)"); ax[1].set_ylabel("Disconnected pieces"); ax[1].set_title("Fragments left over")
    fig.suptitle("The published roads are not joined: splitting and 10 m snapping fixes it", fontweight="bold", fontsize=10, y=1.03)
    _save(fig, F / "L5_network_audit.png")
    # L6 catchments and stock
    ca = pd.read_csv(R / "profile_catchments.csv")
    fig, ax = plt.subplots(1, 2, figsize=(7.2, 2.7))
    ax[0].hist(ca.residents_served / 1000, bins=15, color=TEAL); ax[0].set_xlabel("Residents served (thousands)"); ax[0].set_ylabel("Facilities")
    ax[0].set_title(f"Load is uneven; {prof['facilities']['zero_catchment']} serve nobody")
    ax[1].hist(ca.days_of_cover.dropna(), bins=15, color=AMBER); ax[1].axvline(14, color=CORAL, ls="--", lw=0.8)
    ax[1].set_xlabel("Days of stock cover (GENERATED)"); ax[1].set_title(f"{prof['stock']['facilities_under_14_days']} of 87 hold under 14 days")
    _save(fig, F / "L6_catchments_and_stock.png")
    # L7 / L8 maps
    gp = DATA / "processed" / "cachar.gpkg"
    roads, hab, fac = gpd.read_file(gp, layer="roads"), gpd.read_file(gp, layer="habitations"), gpd.read_file(gp, layer="health_facilities")
    va = pd.read_csv(R / "profile_village_access.csv").set_index("hab_id").reindex(hab.hab_id)
    fig, ax = plt.subplots(figsize=(5.6, 5.6)); ax.set_aspect("equal"); ax.axis("off")
    roads.plot(ax=ax, color=GREY, linewidth=0.4)
    sc = ax.scatter(hab.geometry.x, hab.geometry.y, c=va.time_before_min.clip(upper=45).values, s=3 + 14 * np.sqrt(hab.population / hab.population.max()), cmap="viridis_r", alpha=0.85, linewidths=0)
    ax.scatter(fac.geometry.x, fac.geometry.y, s=14, marker="s", c=NAVY)
    cb = plt.colorbar(sc, ax=ax, shrink=0.6, pad=0.01); cb.set_label("Minutes to nearest facility (capped at 45)")
    ax.set_title("L7. Baseline access: who is far from care before any flood", loc="left")
    _save(fig, F / "L7_baseline_access_map.png")
    vul = pd.read_csv(R / "village_vulnerability.csv").set_index("hab_id").reindex(hab.hab_id)
    crit = pd.read_csv(R / "segment_criticality.csv").head(10)
    fig, ax = plt.subplots(figsize=(5.6, 5.6)); ax.set_aspect("equal"); ax.axis("off")
    roads.plot(ax=ax, color=GREY, linewidth=0.4)
    roads[roads.seg_id.isin(crit.seg_id)].plot(ax=ax, color=NAVY, linewidth=2.2)
    sc = ax.scatter(hab.geometry.x, hab.geometry.y, c=vul.cut_off_freq.values, s=3 + 14 * np.sqrt(hab.population / hab.population.max()), cmap="Reds", vmin=0, vmax=1, alpha=0.9, linewidths=0)
    cb = plt.colorbar(sc, ax=ax, shrink=0.6, pad=0.01); cb.set_label("Share of 60 simulated floods that cut the village off")
    ax.legend(handles=[Line2D([0], [0], color=NAVY, lw=2.2, label="10 most critical road segments")], loc="lower left", frameon=False, fontsize=8)
    ax.set_title("L8. Vulnerable connections: where preventive action pays most", loc="left")
    _save(fig, F / "L8_vulnerability_map.png")


def result_figures(R: Path, F: Path):
    stats = pd.read_csv(R / "allocation_stats.csv"); stats = stats[stats.metric == "unmet_units"]
    pols = ["none", "proportional", "nearest_first", "nearest_first_post", "access_opt"]
    # R1 unmet by policy, single depot vs three hubs, fleet 2
    fig, axes = plt.subplots(1, 3, figsize=(10, 3.3), sharey=True)
    for ax, sev in zip(axes, SEV):
        for k, (cfg, col, off) in enumerate((("single depot (Silchar centre)", GREY, -0.2), ("three hubs", TEAL, 0.2))):
            d = stats[(stats.severity == sev) & (stats.config == cfg) & (stats.fleet == 2)].set_index("policy").reindex(pols)
            x = np.arange(len(pols)) + off
            ax.bar(x, d["mean"], 0.38, color=col, label=cfg if sev == "mild" else None, yerr=[d["mean"] - d.ci_low, d.ci_high - d["mean"]], error_kw={"lw": 0.8, "capsize": 2})
        ax.set_xticks(range(len(pols))); ax.set_xticklabels([POL_LABELS[p].replace(" (", "\n(") for p in pols], rotation=0, fontsize=6.5)
        ax.set_title(sev)
    axes[0].set_ylabel("Unmet demand (units, 14 days)"); axes[0].legend(frameon=False, fontsize=8)
    fig.suptitle("R1. Unmet demand by method, 2 trucks (bars: mean of 20 floods, whiskers: 95% bootstrap CI)", fontweight="bold", fontsize=10, y=1.03)
    _save(fig, F / "R1_unmet_by_policy.png")
    # R2 where the gain comes from (three hubs)
    a = pd.read_csv(R / "allocation_by_scenario.csv")
    fig, axes = plt.subplots(1, 3, figsize=(10, 3.2), sharey=True)
    for ax, fl in zip(axes, (2, 4, 8)):
        rows = []
        for sev in SEV:
            m = a[(a.config == "three hubs") & (a.fleet == fl) & (a.severity == sev)].groupby("policy").unmet_units.mean()
            rows.append({"sev": sev, "info": m["nearest_first"] - m["nearest_first_post"], "opt": m["nearest_first_post"] - m["access_opt"], "rest": m["access_opt"]})
        d = pd.DataFrame(rows)
        ax.bar(d.sev, d.rest, color=GREY, label="still unmet (unreachable / cut off)")
        ax.bar(d.sev, d.opt, bottom=d.rest, color=TEAL, label="removed by optimisation")
        ax.bar(d.sev, d["info"], bottom=d.rest + d.opt, color=GREEN, label="removed by post-flood information")
        ax.set_title(f"{fl} trucks")
    axes[0].set_ylabel("Unmet demand of blind nearest-first (units)")
    h_, l_ = axes[0].get_legend_handles_labels(); fig.legend(h_, l_, loc="lower center", ncol=3, frameon=False, fontsize=8, bbox_to_anchor=(0.5, -0.08))
    fig.suptitle("R2. Where the gain comes from: information first, optimisation when trucks are scarce (three hubs)", fontweight="bold", fontsize=10, y=1.03)
    _save(fig, F / "R2_information_vs_optimisation.png")
    # R3 hub resilience
    h = pd.read_csv(R / "hub_resilience.csv"); h = h[h.split == "test"]
    fig, ax = plt.subplots(1, 2, figsize=(7.2, 2.8))
    cols = [GREY, BLUE, TEAL]
    ax[0].bar(range(3), h.mean_facilities_reachable_share * 100, color=cols); ax[0].set_ylabel("Facilities reachable (%)"); ax[0].set_title("Held-out floods: reach")
    ax[1].bar(range(3), h.share_scenarios_isolated * 100, color=cols); ax[1].set_ylabel("Floods leaving < 50% reachable (%)"); ax[1].set_title("Held-out floods: isolation")
    for a_ in ax:
        a_.set_xticks(range(3)); a_.set_xticklabels(["single depot\n(Silchar)", "single\nresilient", "three hubs"], fontsize=7.5)
    for i, (v, w) in enumerate(zip(h.mean_facilities_reachable_share, h.share_scenarios_isolated)):
        ax[0].text(i, v * 100 + 1, f"{v*100:.0f}%", ha="center"); ax[1].text(i, w * 100 + 1, f"{w*100:.0f}%", ha="center")
    fig.suptitle("R3. Pre-positioning stock at three hubs keeps far more facilities reachable (chosen on 30 floods, tested on 30)", fontweight="bold", fontsize=9.5, y=1.04)
    _save(fig, F / "R3_hub_resilience.png")
    # R4 sensitivity
    s = pd.read_csv(R / "sensitivity.csv")
    fig, axes = plt.subplots(1, 4, figsize=(11, 2.9), sharey=False)
    labels = {"depot_mult": "Depot stock (x baseline)", "horizon": "Planning horizon (days)", "trucks": "Trucks", "rate": "Demand rate (x baseline)"}
    for ax, prm in zip(axes, labels):
        d = s[s.param == prm].groupby(["value", "policy"]).unmet_units.mean().unstack()
        for p in pols:
            ax.plot(d.index, d[p], "-o", ms=3, color=POL_COLORS[p], ls="--" if p == "none" else "-", label=POL_LABELS[p])
        ax.set_xlabel(labels[prm])
    axes[0].set_ylabel("Mean unmet demand (units)"); axes[3].legend(frameon=False, fontsize=6.5, loc="upper left")
    fig.suptitle("R4. Sensitivity (three hubs, 60 floods): the ordering of methods holds; optimisation only matters when trucks are scarce", fontweight="bold", fontsize=9.5, y=1.05)
    _save(fig, F / "R4_sensitivity.png")
    # R5 robustness
    r = pd.read_csv(R / "robustness_missing_roads.csv").groupby("missing_share").agg(overlap=("top10_overlap", "mean"), delta=("delta_cut_off_vs_full", "mean")).reset_index()
    sn = pd.read_csv(R / "sensitivity_snap.csv")
    fig, ax = plt.subplots(1, 2, figsize=(7.4, 2.8))
    ax[0].plot(r.missing_share * 100, r.overlap * 100, "-o", color=CORAL); ax[0].set_xlabel("Real roads missing from our data (%)"); ax[0].set_ylabel("Top-10 worst-hit villages unchanged (%)"); ax[0].set_ylim(0, 100)
    ax[0].set_title("Ranking stability")
    ax[1].bar(sn.snap_m.astype(str), sn.share_cut_off * 100, color=BLUE); ax[1].set_xlabel("Snapping tolerance (m)"); ax[1].set_ylabel("Mean residents cut off (%)"); ax[1].set_title("Result vs network joining")
    for i, v in enumerate(sn.share_cut_off * 100):
        ax[1].text(i, v + 0.3, f"{v:.1f}%", ha="center", fontsize=8)
    fig.suptitle("R5. Robustness: headline cut-off share barely moves; the exact top-10 list is the fragile part", fontweight="bold", fontsize=9.5, y=1.04)
    _save(fig, F / "R5_robustness.png")


def fmt(x, d=0):
    return f"{x:,.{d}f}"


def write_metrics_md(R: Path):
    prof = json.load(open(R / "profile.json")); val = json.load(open(R / "validation.json"))
    a = pd.read_csv(R / "allocation_by_scenario.csv"); pt = pd.read_csv(R / "paired_tests.csv"); h = pd.read_csv(R / "hub_resilience.csv")
    sn = pd.read_csv(R / "sensitivity_snap.csv"); sp = pd.read_csv(R / "sensitivity_speed.csv"); rb = pd.read_csv(R / "robustness_missing_roads.csv")
    vul = pd.read_csv(R / "village_vulnerability.csv").head(8); crit = pd.read_csv(R / "segment_criticality.csv").head(8)
    acc = pd.read_csv(R / "access_by_scenario.csv")
    order = ["none", "proportional", "nearest_first", "nearest_first_post", "access_opt"]
    L = ["# Results and metrics (auto-generated by `python -m floodready report`)", "",
         "All flood scenarios, stock, depot and fleet are GENERATED (seed 42; see `datasets/synthetic/ASSUMPTIONS.md`). Results show how the method",
         "behaves under stated assumptions; they are not measurements of a real flood.", "", "## 1. Data profile (real open data)", "",
         f"- {fmt(prof['ingestion']['villages'])} villages, {fmt(prof['ingestion']['residents'])} residents, {fmt(prof['ingestion']['road_km'])} km of road in {fmt(prof['ingestion']['road_segments'])} segments, {prof['ingestion']['human_health_facilities']} human-health facilities ({prof['facilities']['per_100k_residents']:.1f} per 100,000 residents).",
         f"- Facility cleaning: {prof['ingestion']['medical_raw']} 'Medical' entries, {prof['ingestion']['veterinary_removed']} veterinary removed.",
         f"- Before any flood: median {prof['access_before_flood']['median_min']:.1f} min to the nearest facility, 90th percentile {prof['access_before_flood']['p90_min']:.1f} min; {fmt(prof['access_before_flood']['residents_over_30_min'])} residents live over 30 min away; {fmt(prof['access_before_flood']['unconnected_residents'])} residents are in villages not connected to any facility in the road data.",
         f"- Road network: {fmt(prof['network']['nodes'])} nodes, {fmt(prof['network']['edges'])} edges; {prof['network']['segments_in_main_share_at_10m']*100:.1f}% of segments in one network at 10 m snapping.",
         f"- A facility serves a median {fmt(prof['facilities']['median_residents_served'])} residents (maximum {fmt(prof['facilities']['max_residents_served'])}); {prof['facilities']['zero_catchment']} serve nobody on a travel-time basis; {prof['facilities']['over_30k_residents']} serve over 30,000.",
         f"- Generated stock: median {prof['stock']['median_days_of_cover']:.1f} days of cover; {prof['stock']['facilities_under_14_days']} of 87 facilities hold under 14 days.", "",
         "## 2. Validation checks", "",
         f"- Road circuity (road distance / straight line to the nearest facility): median {val['circuity_median']:.2f}, 90th percentile {val['circuity_p90']:.2f}. Plausible (1 to 2): {val['circuity_plausible_1_to_2']}.",
         f"- Nearest facility by road time equals nearest by straight line for {val['nearest_facility_agreement_pop_weighted']*100:.0f}% of residents (the generated stock used straight-line catchments; a known mismatch).",
         f"- Residents assigned to facilities equal connected residents: {val['pop_assigned_equals_connected']}. Cut-off share rises with severity: {val['severity_monotonic']} ({', '.join(f'{k} {v*100:.1f}%' for k, v in val['share_cut_off_by_severity'].items())}).", "",
         "## 3. Flood impact on access (means over 20 scenarios per severity, 4 trucks, three hubs)", ""]
    ax = acc[acc.config == "three hubs"].groupby("severity")[["share_cut_off", "pop_delayed", "median_time_after_min", "p90_time_after_min", "facilities_out", "depot_reach_share"]].mean().reindex(SEV)
    L += ["| Severity | Residents cut off | Delayed 30+ min | Median time after (min) | 90th pct time after (min) | Facilities out | Facilities reachable from hubs |", "|---|---|---|---|---|---|---|"]
    for sev, r in ax.iterrows():
        L.append(f"| {sev} | {r.share_cut_off*100:.1f}% | {fmt(r.pop_delayed)} | {r.median_time_after_min:.1f} | {r.p90_time_after_min:.1f} | {r.facilities_out:.1f} | {r.depot_reach_share*100:.0f}% |")
    L += ["", "## 4. Pre-positioning: does a single depot survive? (hubs chosen on 30 floods, tested on the other 30)", "", "| Configuration | Split | Facilities reachable | Floods leaving under 50% reachable |", "|---|---|---|---|"]
    for _, r in h.iterrows():
        L.append(f"| {r.config} | {r.split} | {r.mean_facilities_reachable_share*100:.1f}% | {r.share_scenarios_isolated*100:.0f}% |")
    for fl in (2, 8):
        L += ["", f"## 5.{'a' if fl == 2 else 'b'} Unmet demand by method, {fl} trucks (units over 14 days; mean of 20 floods per severity)", "",
              "| Depots | Severity | " + " | ".join(POL_LABELS[p] for p in order) + " |", "|---|---|" + "---|" * len(order)]
        t = a[a.fleet == fl].pivot_table(index=["config", "severity"], columns="policy", values="unmet_units").reindex(columns=order)
        for cfg in a.config.unique():
            for sev in SEV:
                L.append(f"| {cfg} | {sev} | " + " | ".join(fmt(t.loc[(cfg, sev), p]) for p in order) + " |")
    L += ["", "## 6. Paired tests (three hubs, all 60 floods): access-aware optimiser minus reference, units of unmet demand", "",
          "| Trucks | Reference | Mean difference | 95% CI | Win rate | Tie rate | Wilcoxon p |", "|---|---|---|---|---|---|---|"]
    for _, r in pt[(pt.config == "three hubs") & (pt.severity == "all")].sort_values(["fleet", "reference"]).iterrows():
        p = "n/a" if pd.isna(r.wilcoxon_p) else f"{r.wilcoxon_p:.3g}"
        L.append(f"| {int(r.fleet)} | {r.reference} | {r.mean_diff:,.0f} | [{r.ci_low:,.0f}, {r.ci_high:,.0f}] | {r.win_rate*100:.0f}% | {r.tie_rate*100:.0f}% | {p} |")
    cap = a[(a.config == "three hubs") & (a.policy == "access_opt")].groupby("fleet").capture_rate.mean()
    L += ["", f"Capture rate (share of avoidable unmet demand removed by the access-aware optimiser, three hubs): " + ", ".join(f"{int(k)} trucks {v*100:.0f}%" for k, v in cap.items()) + ".",
          "Remaining unmet demand is unavoidable by road delivery: it sits in villages that are cut off or facilities that no truck can reach.", "",
          "## 7. Robustness and sensitivity", "",
          "- Network joining (mean residents cut off): " + "; ".join(f"{r.snap_m:.0f} m: {r.share_cut_off*100:.1f}%" for _, r in sn.iterrows()) + ".",
          "- Travel speed (+/-20%): mean time after flood " + "; ".join(f"x{r.speed_factor}: {r.mean_time_after_min:.1f} min" for _, r in sp.iterrows()) + "; residents cut off unchanged.",
          "- Missing roads (random share of real roads absent from our data): " + "; ".join(f"{k*100:.0f}%: top-10 worst villages overlap {v*100:.0f}%, cut-off share shifts {d*100:+.1f} points" for k, (v, d) in rb.groupby("missing_share")[["top10_overlap", "delta_cut_off_vs_full"]].mean().iterrows()) + ".",
          "- Depot stock, horizon, trucks and demand rate sweeps are in `sensitivity.csv` and figure R4.", "",
          "## 8. Most vulnerable villages and most critical roads", "", "| Village | Residents | Cut off in X% of floods | Expected residents cut off |", "|---|---|---|---|"]
    for _, r in vul.iterrows():
        L.append(f"| {r['name']} | {fmt(r.population)} | {r.cut_off_freq*100:.0f}% | {fmt(r.expected_residents_cut_off)} |")
    L += ["", "| Road segment | Category | Length (km) | Residents cut off if lost alone | Extra person-minutes |", "|---|---|---|---|---|"]
    for _, r in crit.iterrows():
        L.append(f"| {r.road_name} | {r.category} | {r.length_km:.1f} | {fmt(r.residents_cut_off)} | {fmt(r.extra_person_minutes)} |")
    open(R / "METRICS.md", "w", encoding="utf-8").write("\n".join(L) + "\n")


def main(results_dir=RESULTS):
    R = Path(results_dir)
    F = R / "figures"
    F.mkdir(exist_ok=True)
    landing_figures(R, F)
    result_figures(R, F)
    write_metrics_md(R)
    print("figures:", sorted(p.name for p in F.glob("*.png")))
