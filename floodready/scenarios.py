"""Load the generated flood scenarios (datasets/synthetic/flood_scenarios.csv)."""
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "datasets"


@dataclass(frozen=True)
class Scenario:
    name: str
    severity: str
    cut_segments: frozenset = field(default_factory=frozenset)
    out_facilities: frozenset = field(default_factory=frozenset)


NO_FLOOD = Scenario(name="no_flood", severity="none")


def load_scenarios(data_dir=DATA) -> dict:
    sc = pd.read_csv(Path(data_dir) / "synthetic" / "flood_scenarios.csv")
    summary = pd.read_csv(Path(data_dir) / "synthetic" / "scenario_summary.csv")
    out = {}
    for _, row in summary.iterrows():
        s = sc[sc.scenario == row.scenario]
        out[row.scenario] = Scenario(
            name=row.scenario, severity=row.severity,
            cut_segments=frozenset(s[s.kind == "road_segment"].id.astype(int)),
            out_facilities=frozenset(s[s.kind == "facility"].id.astype(int)))
    return out
