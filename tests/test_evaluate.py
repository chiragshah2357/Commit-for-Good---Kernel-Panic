import numpy as np
import pytest

from floodready.evaluate import hub_analysis, run_core, split_scenarios
from floodready.impact import baseline
from floodready.network import load_cachar
from floodready.scenarios import load_scenarios


@pytest.fixture(scope="module")
def world():
    d, sc = load_cachar(), load_scenarios()
    pick = {n: s for n, s in sc.items() if n in ("mild_01", "moderate_02", "severe_03", "severe_11")}
    return d, sc, pick


def test_core_metrics_are_consistent(world):
    d, _, pick = world
    access, alloc, _ = run_core(d, pick, baseline(d), trucks=2)
    assert len(access) == len(pick) and len(alloc) == len(pick) * 5
    assert (alloc.unmet_units >= -1e-9).all()
    assert alloc.capture_rate.dropna().between(-1e-9, 1 + 1e-9).all()
    none = alloc[alloc.policy == "none"]
    assert np.allclose(none.unmet_units, none.none_unmet_units)  # doing nothing leaves exactly the shortfall
    assert (alloc.delivered >= alloc.useful_delivered - 1e-6).all()
    assert (alloc.truck_hours <= alloc.truck_hour_budget + 1e-6).all()


def test_information_and_optimisation_ordering(world):
    d, _, pick = world
    _, alloc, _ = run_core(d, pick, baseline(d), trucks=2)
    for sid, g in alloc.groupby("scenario"):
        u = g.set_index("policy").unmet_units
        assert u["access_opt"] <= u["nearest_first_post"] + 1e-6 <= u["none"] + 1e-6


def test_hub_selection_improves_reach_on_held_out_scenarios(world):
    d, sc, _ = world
    train, test = split_scenarios(sc)
    assert set(train).isdisjoint(test) and len(train) == len(test) == 30
    df, configs = hub_analysis(d, sc)
    t = df[df.split == "test"].set_index("config")
    assert t.loc["three hubs", "mean_facilities_reachable_share"] > t.loc["single depot (Silchar centre)", "mean_facilities_reachable_share"]
    assert len(configs["three hubs"]) == 3
