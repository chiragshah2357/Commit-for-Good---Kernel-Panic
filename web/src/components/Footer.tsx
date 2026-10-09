import { TLink } from "../lib/transition";

const REPO = "https://github.com/chiragshah2357/Commit-for-Good---Kernel-Panic";

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot__grid">
        <div>
          <div className="foot__brand display">Kernel Panic<i className="cursor" /></div>
          <p className="foot__sm">Team Kernel Panic · COMMIT FOR GOOD 2026 · AI for Resilient and Sustainable Supply Chains.</p>
        </div>
        <div>
          <div className="eyebrow">Read</div>
          <ul>
            <li><TLink to="/evidence#problem">The problem</TLink></li>
            <li><TLink to="/evidence#solution">The solution</TLink></li>
            <li><TLink to="/evidence#method">Method and formulas</TLink></li>
            <li><TLink to="/evidence#results">Results</TLink></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow">Data and licences</div>
          <ul>
            <li>PMGSY GeoSadak roads, villages, facilities: Government Open Data Licence India</li>
            <li>Rivers: OpenStreetMap contributors, ODbL</li>
            <li>Terrain: AWS Terrain Tiles</li>
            <li>Code: MIT · <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow">Honest by design</div>
          <p className="foot__sm">Roads, villages and facilities are real open data (July 2022 snapshot). Floods, stock, the depot and the fleet are generated and declared. Every number here is a method result under stated assumptions, not a measured outcome.</p>
        </div>
      </div>
    </footer>
  );
}
