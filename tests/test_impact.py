import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString

from floodready.impact import assess, baseline
from floodready.network import District, build_road_graph, load_cachar
from floodready.scenarios import NO_FLOOD, Scenario, load_scenarios


def _chain_district():
    """Facility - A -- B -- village, three 1 km segments at 60 km/h (1 minute each)."""
    lines = [LineString([(0, 0), (1000, 0)]), LineString([(1000, 0), (2000, 0)]), LineString([(2000, 0), (3000, 0)])]
    roads = gpd.GeoDataFrame({"seg_id": [0, 1, 2], "speed_kmph": 60.0}, geometry=lines, crs="EPSG:32646")
    g = build_road_graph(roads)
    near = lambda x: int(np.argmin(np.abs(g.node_xy[:, 0] - x)))
    hab = pd.DataFrame({"hab_id": [1], "name": ["V"], "population": [100], "node": [near(3000)], "access_min": [0.0], "x": [3000.0], "y": [0.0]})
    fac = pd.DataFrame({"facility_id": [7], "name": ["F"], "stock_units": [10], "demand_per_day": [1.0], "node": [near(0)], "access_min": [0.0], "x": [0.0], "y": [0.0]})
    return District(graph=g, hab=hab, fac=fac, depot_node=near(0), roads=roads)


def test_no_flood_matches_graph_time():
    imp = assess(_chain_district(), NO_FLOOD)
    assert np.isclose(imp.villages.time_before_min[0], 3.0)
    assert imp.summary["pop_cut_off"] == 0


def test_cutting_the_middle_segment_cuts_the_village_off():
    imp = assess(_chain_district(), Scenario("cut", "test", cut_segments=frozenset({1})))
    assert imp.summary["pop_cut_off"] == 100
    assert imp.villages.cut_off[0] and not imp.villages.unconnected[0]
    assert len(imp.ranking()) == 1


def test_facility_outage_cuts_off_when_no_alternative():
    imp = assess(_chain_district(), Scenario("out", "test", out_facilities=frozenset({7})))
    assert imp.summary["pop_cut_off"] == 100


def test_cachar_severity_ordering():
    d = load_cachar()
    sc, before = load_scenarios(), baseline(d)
    mean_cut = {sev: np.mean([assess(d, s, before).summary["share_cut_off"] for s in sc.values() if s.severity == sev][:6])
                for sev in ("mild", "moderate", "severe")}
    assert mean_cut["mild"] < mean_cut["moderate"] < mean_cut["severe"]
    nf = assess(d, NO_FLOOD, before).summary
    assert nf["pop_cut_off"] == 0 and nf["pop_unconnected_baseline"] < 0.03 * nf["population"]
