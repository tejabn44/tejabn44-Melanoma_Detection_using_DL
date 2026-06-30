import { Link, Navigate } from "react-router-dom";
import { CURRENT_HEATMAP_KEY } from "../utils";

function HeatmapPage() {
  const heatmap = JSON.parse(localStorage.getItem(CURRENT_HEATMAP_KEY) || "null");

  if (!heatmap) {
    return <Navigate to="/upload" replace />;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Grad-CAM Visualization</span>
        <h1>Original vs Heatmap</h1>
        <p>The heatmap highlights regions that influenced the model's decision the most.</p>
      </div>

      <div className="compare-grid">
        <article className="card compare-card">
          <h3>Original Image</h3>
          <img src={heatmap.preview} alt="Original lesion" />
        </article>
        <article className="card compare-card">
          <h3>Grad-CAM Heatmap</h3>
          <img
            src={`data:image/png;base64,${heatmap.heatmap_base64}`}
            alt="Grad-CAM heatmap"
          />
        </article>
      </div>

      <Link className="button button-primary" to="/history">
        Open History
      </Link>
    </section>
  );
}

export default HeatmapPage;
