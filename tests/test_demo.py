from floodready.demo import run


def test_demo_walkthrough_runs_and_writes_a_map(tmp_path):
    lines = []
    imp, plan = run("moderate_05", trucks=4, config="hubs", map_path=tmp_path / "m.png", out=lines.append)
    text = "\n".join(lines)
    for section in ("1. DATA", "2. FLOOD SCENARIO", "3. WHO LOSES ACCESS", "4. STOCK HUBS", "5. METHOD COMPARISON", "not a measured outcome"):
        assert section in text
    assert (tmp_path / "m.png").stat().st_size > 10_000
    assert imp.summary["scenario"] == "moderate_05" and plan.policy == "access_opt"
