"""One-scenario walkthrough for the demo: data -> flood -> who loses access -> delivery plan -> method comparison.

Run:  python -m floodready demo --scenario severe_11 --trucks 4 --config hubs --map results/demo_map.png
"""
import json
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from dataclasses import replace
from matplotlib.lines import Line2D

from .allocate import POLICIES, plan
from .impact import DELAY_MIN, assess, baseline
from .network import load_cachar
from .scenarios import load_scenarios

RESULTS = Path(__file__).resolve().parent.parent / "results"
LABELS = {"none": "do nothing", "proportional": "proportional", "nearest_first": "nearest-first (blind)",
          "nearest_first_post": "nearest-first (informed)", "access_opt": "access-aware optimiser"}


def _hubs(config, district):
    f = RESULTS / "hubs.json"
    if config == "single" or not f.exists():
        return (district.depot_node,)
    return tuple(json.load(open(f))["three hubs"])


def draw_map(district, scenario, impact, hubs, path):
    roads, v, fac = district.roads, impact.villages, district.fac
    fig, ax = plt.subplots(figsize=(6.4, 6.4)); ax.set_aspect("equal"); ax.axis("off")
    cut = roads.seg_id.isin(scenario.cut_segments)
    roads[~cut].plot(ax=ax, color="#B9C0CA", linewidth=0.4)
    roads[cut].plot(ax=ax, color="#E4572E", linewidth=0.9)
    status = np.where(v.cut_off, "#E4572E", np.where(v.delay_min >= DELAY_MIN, "#E8A33D", "#1F8A8A"))
    h = district.hab
    ax.scatter(h.x, h.y, c=status, s=3 + 14 * np.sqrt(h.population / h.population.max()), alpha=0.85, linewidths=0)
    out = fac.facility_id.isin(scenario.out_facilities)
    ax.scatter(fac.x[~out], fac.y[~out], s=16, marker="s", c="#1B2A41")
    ax.scatter(fac.x[out], fac.y[out], s=48, marker="s", facecolors="none", edgecolors="#E4572E", linewidths=1.1)
    hx, hy = district.graph.node_xy[list(hubs)].T
    ax.scatter(hx, hy, s=130, marker="*", c="#7B3FA0", edgecolors="white", linewidths=0.6, zorder=5)
    ax.legend(handles=[Line2D([0], [0], color="#E4572E", lw=1.6, label="road cut"), Line2D([0], [0], marker="o", color="none", markerfacecolor="#1F8A8A", label="village ok"),
                       Line2D([0], [0], marker="o", color="none", markerfacecolor="#E8A33D", label="delayed 30+ min"), Line2D([0], [0], marker="o", color="none", markerfacecolor="#E4572E", label="cut off"),
                       Line2D([0], [0], marker="s", color="none", markerfacecolor="#1B2A41", label="facility"), Line2D([0], [0], marker="s", color="none", markerfacecolor="none", markeredgecolor="#E4572E", label="facility out"),
                       Line2D([0], [0], marker="*", color="none", markerfacecolor="#7B3FA0", markersize=11, label="stock hub")], loc="lower left", frameon=False, fontsize=7)
    ax.set_title(f"{scenario.name}: {impact.summary['share_cut_off']*100:.0f}% of residents cut off", loc="left", fontweight="bold")
    fig.savefig(path, dpi=180, bbox_inches="tight"); plt.close(fig)


def run(scenario_name="severe_11", trucks=4, config="hubs", map_path=None, top=10, out=print):
    district, scenarios = load_cachar(), load_scenarios()
    s = scenarios[scenario_name]
    hubs = _hubs(config, district)
    imp = assess(district, s, baseline(district))
    prof = json.load(open(RESULTS / "profile.json")) if (RESULTS / "profile.json").exists() else None
    sm = imp.summary
    out("=" * 78 + f"\n 1. DATA (real, open): Cachar district, Assam")
    out(f"    {len(district.hab):,} villages | {sm['population']:,} residents | {district.roads.length_m.sum()/1000:,.0f} km of road | {len(district.fac)} human-health facilities")
    if prof:
        a = prof["access_before_flood"]
        out(f"    Before any flood: median {a['median_min']:.0f} min and 90th percentile {a['p90_min']:.0f} min to the nearest facility; {a['residents_over_30_min']:,} residents are over 30 min away")
    cut_km = district.roads.length_m[district.roads.seg_id.isin(s.cut_segments)].sum() / 1000
    out(f"\n 2. FLOOD SCENARIO (generated, seed 42): {s.name} ({s.severity})")
    out(f"    {cut_km:,.0f} km of road cut ({cut_km / (district.roads.length_m.sum()/1000)*100:.0f}%) | {len(s.out_facilities)} of {len(district.fac)} facilities out of service")
    out(f"\n 3. WHO LOSES ACCESS")
    out(f"    {sm['pop_cut_off']:,} residents cut off ({sm['share_cut_off']*100:.1f}%) in {sm['villages_cut_off']} villages | {sm['pop_delayed']:,} delayed {DELAY_MIN:.0f}+ min | mean travel {sm['mean_time_before_min']:.1f} -> {sm['mean_time_after_min']:.1f} min")
    r = imp.ranking(top)[["name", "population", "time_before_min", "time_after_min", "cut_off"]].copy()
    r["time_after_min"] = r.time_after_min.replace(np.inf, np.nan)
    r.columns = ["village", "residents", "min before", "min after", "cut off"]
    out(r.round(1).fillna("unreachable").to_string(index=False))
    out(f"\n 4. STOCK HUBS ({'3 pre-positioned hubs' if len(hubs) > 1 else 'single depot at Silchar'}) and {trucks} trucks, deliveries within 3 days")
    p = plan(district, s, imp, "access_opt", trucks=trucks, hubs=hubs)
    t = p.table
    reach = np.isfinite(t.depot_minutes[t.working]).mean()
    out(f"    {reach*100:.0f}% of working facilities are reachable from a hub in this flood | visits {p.summary['visits']} | truck-hours {p.summary['truck_hours']:.0f} of {p.summary['truck_hour_budget']:.0f}")
    plan_rows = t[t.deliver > 0].sort_values("deliver", ascending=False).head(top)[["name", "depot_minutes", "stock", "shortfall_post", "deliver"]].copy()
    plan_rows.columns = ["facility", "min from hub", "stock", "shortfall", "deliver"]
    out("\n    Delivery plan (top by units):"); out(plan_rows.round(0).to_string(index=False) if len(plan_rows) else "    no facility is reachable: nothing can be delivered by road")
    out(f"\n 5. METHOD COMPARISON (unmet demand over 14 days, units)")
    rows = []
    for pol in POLICIES:
        sm2 = plan(district, s, imp, pol, trucks=trucks, hubs=hubs).summary
        rows.append({"method": LABELS[pol], "unmet": sm2["unmet_units"], "visits": sm2["visits"], "stocked-out facilities": sm2["facilities_stocked_out"],
                     "captured %": sm2["capture_rate"] * 100 if sm2["capture_rate"] == sm2["capture_rate"] else np.nan})
    out(pd.DataFrame(rows).round(0).fillna("-").to_string(index=False))
    out(f"    Plus {p.summary['cut_off_units']:,.0f} units of demand in cut-off villages that no road delivery can serve.")
    out("\n    Generated stock and flood: this shows how the method behaves under stated assumptions, not a measured outcome.\n" + "=" * 78)
    if map_path:
        draw_map(district, s, imp, hubs, map_path)
        out(f"    map written to {map_path}")
    return imp, p
