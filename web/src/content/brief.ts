// Content of the Round 1 innovation brief (9 Oct 2026), kept in one place. Numbers are quoted from the submitted PDF.

export type EvidenceKind = "press" | "field" | "abstract" | "atlas" | "news";

export const TABLE1: { indicator: string; finding: string; ref: string; type: string; kind: EvidenceKind }[] = [
  { indicator: "People and villages affected, Assam, 3 Jul 2024", finding: "More than 11 lakh people in 28 districts; 2,208 villages in 84 revenue circles", ref: "[1]", type: "Press report of ASDMA bulletin", kind: "press" },
  { indicator: "Facility damage, Khelua PHC area, Sivasagar", finding: "16 of 19 sub-health centres damaged; stored medicines destroyed", ref: "[2]", type: "News report (year not stated)", kind: "news" },
  { indicator: "Facility flooding, Jalapur PHC, Cachar (May 2022)", finding: "Outpatient department under stagnant water for 7 days; medicines washed away", ref: "[3]", type: "Field report", kind: "field" },
  { indicator: "Use of public facilities during floods (char communities, Lakhimpur)", finding: "Use fell from 62% to 38%; fever cases rose from 28.4% to 42.7%", ref: "[6]", type: "Conference abstract (secondary)", kind: "abstract" },
  { indicator: "Population living on river islands (chars)", finding: "More than 30 lakh, about 10% of Assam's population, citing NHM Assam", ref: "[6]", type: "As reported (secondary)", kind: "abstract" },
  { indicator: "Long-term flood frequency", finding: "About 28.3% of Assam's land inundated at least once, 1998 to 2007", ref: "[8], [9]", type: "NRSC atlas (2011 edition) via India Water Portal", kind: "atlas" },
  { indicator: "Official vs field accounts of medicine availability", finding: "“Adequate stock” stated at reviews; shortages for patients on daily medication reported in the field", ref: "[4], [5]", type: "News reports", kind: "news" },
];

export const TABLE2: { approach: string; provides: string; limit: string; ref: string }[] = [
  { approach: "NHM boat clinics (since 2008; Lakhimpur, Dhemaji and other districts)", provides: "Health care for river-island (char) communities", limit: "Units may not operate when ferry movement is banned during high water; road-based emergency services remain insufficient for char areas", ref: "[6], [7]" },
  { approach: "NRSC flood inundation maps and hazard atlas (1998 to 2023)", provides: "Where, and how often, land floods", limit: "Rapid-mapping products are preliminary and not ground-verified; they describe water, not access to care", ref: "[8], [10]" },
  { approach: "ASDMA daily flood reports", provides: "District counts of people, villages and damaged roads", limit: "Descriptive and retrospective; no facility-level access measure and no allocation guidance; daily damage counts are not cumulative", ref: "[1], [10]" },
  { approach: "NHM review of stock availability", provides: "District-level check that medicines are in stock", limit: "Availability is not delivery; it does not say which villages can be reached", ref: "[4], [5]" },
];

export const TABLE4: { risk: string; why: string; mitigation: string; now: string }[] = [
  { risk: "Road data is a July 2022 snapshot", why: "Recent roads and bridges are absent", mitigation: "Merge OpenStreetMap; state the snapshot date in every result", now: "Unchanged. The date is stated on every page; the OSM merge is not done." },
  { risk: "Flood extent and stock are generated", why: "Results cannot be read as real outcomes", mitigation: "Declare; report sensitivity ranges; substitute a dated NRSC inundation map where a usable layer is obtained", now: "Declared everywhere; ranges reported (Fig. R4). A dated NRSC layer is still to be obtained." },
  { risk: "About 10% of segments stay disconnected after snapping", why: "Some villages are unreachable in the model", mitigation: "Report coverage; cross-check against OpenStreetMap", now: "Reduced: splitting lines at junctions as well as snapping joins 98.7% of segments. 14,405 residents remain in unconnected villages and are reported separately." },
  { risk: "Facilities identified by name only", why: "Tier (PHC, sub-centre, hospital) is unknown", mitigation: "Treat all as service points; add tiers from NHM directories if available", now: "Unchanged. All 87 are treated as service points." },
];

export const TABLE5: { activity: string; team: string; ai: string }[] = [
  { activity: "Problem selection", team: "Set the direction, compared the flood-access problem with six alternatives, chose it, and directed how it was developed.", ai: "Proposed candidate problem areas, compared them against the organisers' criteria, and elaborated the chosen one." },
  { activity: "Evidence", team: "Directed the topics searched and decided what to include; will verify against primary sources before Round 2.", ai: "Ran web searches and summarised the reports and papers cited in Section 7." },
  { activity: "Data", team: "Chose open government data as the basis, following the organisers' data guide; approved each download by file name, source and size; decided that missing inputs would be generated and declared.", ai: "Retrieved the files, wrote and ran the cleaning, audit and scenario-generation scripts, and produced the synthetic data under a fixed seed." },
  { activity: "Brief and figures", team: "Provided the direction and accepts responsibility for the submission.", ai: "Drafted this brief and produced the figures from the repository data." },
  { activity: "Round 2 build", team: "Set the goals and the git and pull-request rules, reviewed each step, and decided what to keep, cut and defer.", ai: "Wrote the network, access-loss, allocation, evaluation, API and web code and its tests, and drafted the documentation." },
];

export const REFS: { n: number; text: string; url: string }[] = [
  { n: 1, text: "ETV Bharat. Assam flood death toll stands at 38 as three drown in last 24 hours, 3 July 2024.", url: "https://etvbharat.com/en/!state/assam-flood-death-toll-stands-at-38-as-three-drown-in-last-24-hours-enn24070300724" },
  { n: 2, text: "Sentinel Assam. Assam: Flood damages Khelua PHC, disrupts healthcare services.", url: "https://www.sentinelassam.com/north-east-india-news/assam-news/assam-flood-damages-khelua-phc-disrupts-healthcare-services" },
  { n: 3, text: "Down To Earth. Bedevilled Barak: how a PHC in Katigorah rebuilt itself after the 2022 Assam floods.", url: "https://www.downtoearth.org.in/amp/story/natural-disasters/bedevilled-barak-how-a-phc-in-katigorah-rebuilt-itself-after-the-2022-assam-floods-94440" },
  { n: 4, text: "Sentinel Assam. National Health Mission MD reviews flood situation in Assam.", url: "https://sentinelassam.com/guwahati-city/national-health-mission-md-reviews-flood-situation-in-assam-597501" },
  { n: 5, text: "Open Magazine. Assam now faces a health crisis in flood-hit areas.", url: "https://openthemagazine.com/india/assam-now-faces-a-health-crisis-in-flood-hit-areas" },
  { n: 6, text: "Oars of hope: boat-based healthcare and public health equity in flood-prone char/sapori communities. Population Medicine (abstract).", url: "https://www.populationmedicine.eu/Oars-of-hope-boat-based-healthcare-and-public-health-equity-in-flood-prone-char-sapori,232956,0,2.html" },
  { n: 7, text: "Assam Tribune. Boat clinics to the rescue in flood-hit areas.", url: "https://assamtribune.com/boat-clinics-to-the-rescue-in-flood-hit-areas" },
  { n: 8, text: "National Remote Sensing Centre. Flood Hazard Zonation Atlas of Assam using multi-sensor satellite data, 1998 to 2023.", url: "https://www.nrsc.gov.in/nrscnew/assets/pdf/Flood_Hazard_Zonation_Atlas_of_Assam_using_multi_sensor_satellite_data1998_2023.pdf" },
  { n: 9, text: "India Water Portal. Flood hazard zonation of Assam: an atlas by National Remote Sensing Centre.", url: "https://indiawaterportal.org/articles/flood-hazard-zonation-assam-atlas-national-remote-sensing-centre" },
  { n: 10, text: "ASDMA / NRSC. Flood inundation reports (e.g. 28 June 2022).", url: "https://asdma.assam.gov.in/sites/default/files/swf_utility_folder/departments/asdma_revenue_uneecopscloud_com_oid_70/this_comm/assam_28jun2022_floodreport.pdf" },
  { n: 11, text: "Ministry of Rural Development, Government of India. PMGSY Rural Connectivity Datasets (GeoSadak).", url: "https://geosadak-pmgsy.nic.in/OpenData" },
  { n: 12, text: "datameet. pmgsy-geosadak (community mirror, July 2022 snapshot).", url: "https://github.com/datameet/pmgsy-geosadak" },
  { n: 13, text: "OpenStreetMap contributors. Waterway data via the Overpass API (ODbL).", url: "https://www.openstreetmap.org/copyright" },
  { n: 14, text: "Terrain Tiles on AWS (Terrarium, zoom 10).", url: "https://registry.opendata.aws/terrain-tiles/" },
  { n: 15, text: "Government Open Data Licence, India.", url: "https://data.gov.in/government-open-data-license-india" },
  { n: 16, text: "Team Kernel Panic. Commit-for-Good---Kernel-Panic (code, data pipeline, assumptions, audit). All sources accessed 9 October 2026.", url: "https://github.com/chiragshah2357/Commit-for-Good---Kernel-Panic" },
];
