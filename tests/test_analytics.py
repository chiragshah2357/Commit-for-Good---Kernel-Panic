"""Tests for the what-if engine behind the web calculator (floodgen, score, analytics)."""
import numpy as np
import pytest

from floodready import score
from floodready.analytics import STATUS, Engine, Setup
from floodready.impact import assess
from floodready.scenarios import NO_FLOOD


@pytest.fixture(scope="module")
def eng():
    return Engine()


@pytest.fixture(scope="module")
def sim(eng):
    s = Setup(trucks=4, hubs=eng.three_hubs)
    return s, eng.simulate(eng.scenarios["severe_11"], s)


def test_parametric_flood_reproduces_the_preset_rule(eng):
    # same rule and the stored (rounded) height and reach: only boundary rounding may differ
    row = eng.summary.loc["severe_11"]
    s = eng.features.parametric(row.flood_height_m, row.flood_distance_m)
    preset = eng.scenarios["severe_11"]
    assert len(s.cut_segments ^ preset.cut_segments) <= 3
    assert len(s.cut_segments) > 300


def test_parametric_flood_grows_with_height_and_reach(eng):
    small = eng.features.parametric(1.0, 150)
    big = eng.features.parametric(4.5, 1500)
    assert small.cut_segments < big.cut_segments
    assert eng.features.parametric(0, 0).cut_segments == frozenset()


def test_index_is_bounded_and_weights_normalise():
    perfect = {"access": 1.0, "supply": 1.0, "equity": 1.0, "reach": 1.0}
    assert score.index(perfect)["value"] == pytest.approx(100.0)
    assert score.index({k: 0.0 for k in perfect})["value"] == 0.0
    w = score.normalise({"access": 2, "supply": 2, "equity": 0, "reach": 0})
    assert w["access"] == pytest.approx(0.5) and sum(w.values()) == pytest.approx(1.0)
    assert score.normalise({"access": 0, "supply": 0, "equity": 0, "reach": 0}) == score.DEFAULT_WEIGHTS


def test_simulate_matches_the_core_models(eng, sim):
    s, r = sim
    imp = assess(eng.base, eng.scenarios["severe_11"], eng.before())
    assert r["access"]["pop_cut_off"] == imp.summary["pop_cut_off"] == 715833
    assert r["access"]["villages_cut_off"] == imp.summary["villages_cut_off"]
    st = np.array(r["villages"]["status"])
    assert (st == STATUS["cut_off"]).sum() == imp.summary["villages_cut_off"]
    assert r["policies"]["access_opt"]["unmet_units"] <= r["policies"]["none"]["unmet_units"]
    assert r["policies"]["nearest_first_post"]["unmet_units"] <= r["policies"]["nearest_first"]["unmet_units"]   # information helps


def test_no_flood_has_a_better_index_than_a_severe_flood(sim):
    _, r = sim
    assert r["no_flood_index"]["value"] > r["policies"]["access_opt"]["index"]["value"]


def test_routes_and_schedule_are_consistent_with_the_plan(eng, sim):
    s, r = sim
    ch = r["chosen"]
    served = {f["id"] for f in ch["facilities"] if f["deliver"] > 0}
    assert {x["facility_id"] for x in ch["routes"]} <= served and len(ch["routes"]) > 0
    for route in ch["routes"]:
        assert len(route["path"]) >= 2
    hours = sum(t["hours"] for t in ch["schedule"]["trips"])
    assert hours == pytest.approx(r["policies"]["access_opt"]["truck_hours"], rel=1e-6)
    assert ch["schedule"]["overflow_trips"] == 0
    assert all(t["truck"] in range(1, s.trucks + 1) for t in ch["schedule"]["trips"])


def test_decomposition_adds_up(sim):
    _, r = sim
    dc, ch = r["decomposition"], r["policies"]["access_opt"]
    assert dc["unreachable_facilities"] + dc["reachable_not_served"] == pytest.approx(ch["unmet_units"], rel=1e-6)
    assert dc["cut_off_villages"] == pytest.approx(ch["cut_off_units"])


def test_manual_flood_cuts_exactly_what_was_chosen(eng):
    sc = eng.resolve_scenario("manual", cut_segments=[1, 2, 3, 99999], out_facilities=[])
    assert sc.cut_segments == frozenset({1, 2, 3})   # unknown ids are dropped


def test_ensemble_orders_the_methods_and_ci_brackets_the_mean(eng):
    e = eng.ensemble(Setup(trucks=4, hubs=eng.three_hubs))
    p = e["policies"]
    assert e["n"] == 60
    assert p["access_opt"]["total_unmet_mean"] < p["none"]["total_unmet_mean"]
    for v in p.values():
        assert v["total_unmet_lo"] <= v["total_unmet_mean"] <= v["total_unmet_hi"]
        assert v["cvar10_total_unmet"] >= v["total_unmet_mean"]
    assert {x["reference"] for x in e["paired"]} == {"none", "proportional", "nearest_first", "nearest_first_post"}


def test_repair_gain_is_real(eng):
    sc = eng.scenarios["moderate_03"]
    rp = eng.repair(sc, Setup(hubs=eng.three_hubs), top=3)
    assert rp["rows"], "a moderate flood should have at least one repair that helps"
    top = rp["rows"][0]
    before = assess(eng.base, sc, eng.before()).summary["pop_cut_off"]
    after = assess(eng.base, type(sc)(sc.name + "_r", sc.severity, sc.cut_segments - {top["seg_id"]}, sc.out_facilities), eng.before()).summary["pop_cut_off"]
    assert before - after == top["residents_regained"]


def test_uncertainty_band_is_ordered(eng):
    u = eng.uncertainty(eng.scenarios["moderate_03"], Setup(hubs=eng.three_hubs), missing_share=0.1, reps=6)
    for k in ("share_cut_off", "total_unmet", "index"):
        assert u[k]["p05"] <= u[k]["p50"] <= u[k]["p95"]


def test_no_flood_scenario_is_valid_in_the_engine(eng):
    r = eng.simulate(NO_FLOOD, Setup(hubs=eng.three_hubs))
    assert r["access"]["pop_cut_off"] == 0
