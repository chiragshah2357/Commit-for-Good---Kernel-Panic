# Data audit (9 Oct 2026)

Question: can the Cachar flood-access prototype run on real, openly available data, or must it be synthetic?
Answer: **mostly real; stock, fleet and flood scenarios are synthetic.** Scripts are in `audit/`.

## Findings

| Check | Result |
|---|---|
| Raw files fetched | PMGSY roads (40.7 MB), habitations (1.4 MB), facilities (1.4 MB); WorldPop (18.3 MB); OSM waterways (4.4 MB); 12 terrain tiles (0.7 MB) |
| Cachar identified | `DISTRICT_I = 97` (found as the district of the habitations nearest Silchar; 100% of the 200 nearest) |
| Habitations | 1,188 in Cachar, total population 1,622,303; median 986; none with zero population |
| Habitation population field | present (`TOT_POPULA`) |
| Roads | 1,136 segments, 3,525 km (mostly village roads `RR(VR)`, plus NH, SH, MDR) |
| Facility categories (Cachar) | Transport/Admin 351, Education 310, Agro 261, Medical 119 |
| "Medical" facilities | 119, of which 32 are veterinary (removed by name); **87 human-health facilities kept** |
| Road graph as published | 215 disconnected components at 1 m tolerance: segments are not joined |
| Road graph after snapping endpoints within 10 m | largest component holds 90.4% of segments |
| Population within 500 m of that main network | 88.0% |
| Human-health facilities near the main network | 118 of 119 medical facilities within 500 m (before the veterinary filter) |
| OpenStreetMap in the Cachar bounding box | 27,719 highway ways, 486 village/hamlet points, 75 hospital/clinic/doctor points |
| Waterways used | 219 rivers, 43 canals, 24 named streams |

## Caveats

- **The source is a July 2022 snapshot** of the PMGSY data; the original portal was unreachable from the audit
  machine, so the datameet mirror is used.
- The road graph needs endpoint snapping (10 m) before routing; about 10% of segments stay disconnected.
- "Human-health facility" is identified by category and name only (veterinary words removed). Facility tier (PHC,
  sub-centre, hospital) is not an official field.
- PMGSY roads are rural roads plus some higher-tier roads; coverage of urban Silchar streets is thin. OSM could
  supplement it if needed.
- The WorldPop cross-check was not conclusive (its bounding-box total includes neighbouring districts) and the
  habitation population has not been independently validated.
- A real vector flood extent (NRSC inundation maps) was **not** obtained: the maps found were PDF images. The
  flood scenarios are therefore synthetic.
- Not yet checked: whether the Bhuvan flood layers can be used as a web map service, and their licence.
