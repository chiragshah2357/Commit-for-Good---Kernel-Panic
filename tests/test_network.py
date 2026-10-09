import geopandas as gpd
import numpy as np
from shapely.geometry import LineString

from floodready.network import build_road_graph, load_cachar


def _roads(lines, speed=30):
    return gpd.GeoDataFrame({"seg_id": range(len(lines)), "speed_kmph": speed}, geometry=lines, crs="EPSG:32646")


def test_crossing_lines_become_connected():
    g = build_road_graph(_roads([LineString([(0, 0), (100, 100)]), LineString([(0, 100), (100, 0)])]))
    n, _ = g.components()
    assert n == 1  # an X crossing is split at the crossing point and joined


def test_t_junction_within_snap_distance_is_connected():
    main = LineString([(0, 0), (200, 0)])
    spur = LineString([(100, 6), (100, 100)])  # ends 6 m short of the main road
    n, _ = build_road_graph(_roads([main, spur])).components()
    assert n == 1


def test_distant_lines_stay_disconnected():
    n, _ = build_road_graph(_roads([LineString([(0, 0), (50, 0)]), LineString([(500, 500), (600, 500)])])).components()
    assert n == 2


def test_cutting_a_segment_removes_its_edges_and_disconnects():
    g = build_road_graph(_roads([LineString([(0, 0), (100, 0)]), LineString([(100, 0), (200, 0)])]))
    assert g.components()[0] == 1
    cut = g.matrix(cut_segments={1})
    assert cut.nnz < g.matrix().nnz
    assert set(g.seg_id) == {0, 1}  # original ids are preserved on edges


def test_travel_time_follows_speed():
    g = build_road_graph(_roads([LineString([(0, 0), (1000, 0)])], speed=60))
    assert np.isclose(g.minutes.sum(), 1.0)  # 1 km at 60 km/h is 1 minute


def test_cachar_network_is_connected_and_attached():
    d = load_cachar()
    _, labels = d.graph.components()
    big = np.bincount(labels).argmax()
    in_main = set(d.graph.seg_id[labels[d.graph.u] == big])
    assert len(in_main) / d.roads.seg_id.nunique() > 0.95
    assert (labels[d.fac.node] == big).all()          # every health facility is on the main network
    assert labels[d.depot_node] == big
    assert d.fac.stock_units.notna().all()
