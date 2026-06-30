import { Link } from "react-router-dom";

function HomePage() {
  return (
    <section className="hero-grid">
      <div className="hero-copy">
        <span className="eyebrow">Computer-Aided Skin Screening</span>
        <h1>AI Melanoma Detection</h1>
        <p>
          Upload a lesion image, receive a melanoma risk prediction, inspect Grad-CAM
          heatmaps, and keep your past analysis history locally in the browser.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/upload">
            Start Analysis
          </Link>
          <Link className="button button-secondary" to="/about">
            Learn More
          </Link>
        </div>
      </div>

      <div className="hero-panel card">
        <div className="stat-stack">
          <article>
            <span>Prediction Output</span>
            <strong>Melanoma / Non-Melanoma</strong>
          </article>
          <article>
            <span>Explainability</span>
            <strong>Grad-CAM Heatmap Overlay</strong>
          </article>
          <article>
            <span>History</span>
            <strong>Saved in Local Storage</strong>
          </article>
        </div>
      </div>
    </section>
  );
}

export default HomePage;
