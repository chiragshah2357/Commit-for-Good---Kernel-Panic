"""HTTP contract tests for the web calculator API."""
import pytest
from fastapi.testclient import TestClient

from floodready.api import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_and_meta(client):
    assert client.get("/api/health").json()["ok"] is True
    m = client.get("/api/meta").json()
    assert len(m["presets"]) == 60 and {p["id"] for p in m["policies"]} >= {"none", "access_opt"}
    assert abs(sum(m["index"]["weights"].values()) - 1) < 1e-9
    assert m["counts"]["villages"] == 1188


def test_simulate_preset_defaults(client):
    r = client.post("/api/simulate", json={}).json()
    assert r["scenario"]["name"] == "severe_11" and r["access"]["pop_cut_off"] == 715833
    assert set(r["policies"]) == {"none", "proportional", "nearest_first", "nearest_first_post", "access_opt"}
    assert len(r["villages"]["status"]) == 1188


def test_simulate_hand_drawn_flood_and_custom_hub(client):
    body = {"flood": {"mode": "manual", "cut_segments": [458, 670]}, "setup": {"hubs": {"config": "custom", "points": [[92.78, 24.83]]}, "trucks": 2}}
    r = client.post("/api/simulate", json=body).json()
    assert r["scenario"]["segments_cut"] == 2 and len(r["hubs"]) == 1


def test_parametric_preview_grows_with_height(client):
    a = client.post("/api/flood/preview", json={"flood": {"mode": "parametric", "height_m": 1.0, "distance_m": 150}}).json()
    b = client.post("/api/flood/preview", json={"flood": {"mode": "parametric", "height_m": 4.5, "distance_m": 1500}}).json()
    assert a["segments_cut"] < b["segments_cut"] and a["share_cut_off"] < b["share_cut_off"]


def test_validation_and_unknown_preset(client):
    assert client.post("/api/simulate", json={"setup": {"trucks": 0}}).status_code == 422
    assert client.post("/api/simulate", json={"setup": {"policy": "magic"}}).status_code == 422
    assert client.post("/api/simulate", json={"flood": {"mode": "preset", "preset": "tsunami_01"}}).status_code == 404


def test_ensemble_and_pareto_endpoints(client):
    e = client.post("/api/ensemble", json={}).json()
    assert e["n"] == 60 and "access_opt" in e["policies"]
    p = client.post("/api/pareto", json={"setup": {"trucks": 4}}).json()
    assert p["rows"][0]["trucks"] == 1 and p["knee"] in [r["trucks"] for r in p["rows"]]
