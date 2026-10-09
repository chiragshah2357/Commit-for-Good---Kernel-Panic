import numpy as np
import pytest

from floodready.allocate import POLICIES, plan
from floodready.impact import assess, baseline
from floodready.network import load_cachar
from floodready.scenarios import load_scenarios


@pytest.fixture(scope="module")
def world():
    d = load_cachar()
    sc = load_scenarios()
    b = baseline(d)
    names = ["mild_00", "moderate_00", "severe_00", "severe_11"]
    return d, {n: (sc[n], assess(d, sc[n], b)) for n in names}


def test_deliveries_respect_depot_stock_and_time_budget(world):
    d, scen = world
    depot = 10 * d.fac.demand_per_day.sum()
    for s, imp in scen.values():
        for p in POLICIES:
            r = plan(d, s, imp, p, trucks=2).summary
            assert r["delivered"] <= depot + 1e-6
            assert r["truck_hours"] <= 2 * 10 * 3 + 1e-6


def test_no_delivery_to_out_of_service_or_unreachable_facilities(world):
    d, scen = world
    s, imp = scen["severe_11"]
    t = plan(d, s, imp, "access_opt").table
    assert (t.deliver[~t.working] == 0).all()
    assert (t.deliver[~np.isfinite(t.depot_minutes)] == 0).all()


def test_access_aware_plan_is_never_worse_than_doing_nothing_or_baselines(world):
    d, scen = world
    for s, imp in scen.values():
        u = {p: plan(d, s, imp, p).summary["unmet_units"] for p in POLICIES}
        assert u["access_opt"] <= u["none"] + 1e-6
        assert u["access_opt"] <= u["proportional"] + 1e-6
        assert u["access_opt"] <= u["nearest_first"] + 1e-6


def test_unknown_policy_raises(world):
    d, scen = world
    s, imp = scen["mild_00"]
    with pytest.raises(ValueError):
        plan(d, s, imp, "magic")
