import React from "react";
import { enterpriseFeatures, enterpriseLabTracks, enterpriseRoadmap } from "./enterpriseCatalog";

export default function EnterpriseLabsHub() {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <header>
        <h2>🧪 Enterprise Labs (Core Prodotto)</h2>
        <p>Full catalog of enterprise labs and platform differentiators.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {enterpriseLabTracks.map((track) => (
          <article key={track.pillar} style={{ border: "1px solid #1f2937", borderRadius: 10, padding: 12 }}>
            <h3>{track.pillar}</h3>
            <ul>
              {track.labs.map((lab) => (
                <li key={lab}>{lab}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <h3>⚙️ Enterprise Features</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {enterpriseFeatures.map((feature) => (
          <article key={feature.area} style={{ border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
            <h4>{feature.area}</h4>
            <ul>
              {feature.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <h3>🚀 Feature Future Roadmap</h3>
      <ol>
        {enterpriseRoadmap.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
