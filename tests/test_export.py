"""The static JSON the web pages read must agree with the engine it was exported from."""
import pytest

from floodready import export
from floodready.analytics import Engine


@pytest.fixture(scope="module")
def eng():
    return Engine()


def test_geometry_matches_the_engine(eng):
    g = export.geometry(eng)
    assert [r["id"] for r in g["roads"]] == sorted(eng.base.roads.seg_id.tolist())
    assert g["villages"]["id"] == eng.base.hab.hab_id.astype(int).tolist()          # the web app colours villages by this order
    assert g["facilities"]["id"] == eng.base.fac.facility_id.astype(int).tolist()
    assert len(g["hull"]) >= 12 and len(g["hubs"]["three"]) == 3
    lo0, la0, lo1, la1 = g["bounds"]
    assert 92 < lo0 < lo1 < 94 and 24 < la0 < la1 < 26                               # Cachar, Assam


def test_scenarios_file_has_all_floods_and_a_worked_example(eng):
    s = export.scenarios(eng)
    assert len(s["presets"]) == 60 and {p["severity"] for p in s["presets"]} == {"mild", "moderate", "severe"}
    assert s["hero"]["scenario"] == "severe_11" and len(s["hero"]["status"]) == len(eng.base.hab)
    assert s["hero"]["access"]["pop_cut_off"] == 715833


def test_evidence_has_the_series_the_figures_need():
    e = export.evidence()
    for k in ("profile", "validation", "village_bands", "road_categories", "access_cdf", "catchments", "snap_mvp", "snap_round1", "scenario_summary",
              "alloc_stats", "alloc_means", "paired", "hub_resilience", "sensitivity", "robustness", "vulnerability_top", "criticality_top"):
        assert e[k], k
    assert len(e["scenario_summary"]) == 60 and e["profile"]["ingestion"]["human_health_facilities"] == 87
