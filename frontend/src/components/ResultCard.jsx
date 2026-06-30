import Tooltip from "./Tooltip";

function ResultCard({ result, imageUrl }) {
  if (!result) {
    return null;
  }

  const isMelanoma = result.prediction === "melanoma";

  return (
    <section className="card result-card">
      <div className="result-media">
        <img src={imageUrl} alt="Uploaded lesion" />
      </div>

      <div className="result-info">
        <div className="eyebrow">
          Prediction Result
          <Tooltip text="This prediction is AI-generated and should support clinical review, not replace it." />
        </div>

        <h2 className={isMelanoma ? "danger" : "safe"}>
          {isMelanoma ? "Melanoma Detected" : "Non-Melanoma Detected"}
        </h2>

        <div className="metric-grid">
          <article className="metric-card">
            <span>{result.confidence_label || "Confidence"}</span>
            <strong>{result.confidence}%</strong>
          </article>
          <article className="metric-card">
            <span>Risk Level</span>
            <strong>{result.risk_level}</strong>
          </article>
          <article className="metric-card">
            <span>Status</span>
            <strong>{result.prediction}</strong>
          </article>
        </div>

        <div className="progress-block">
          <div className="progress-label">
            <span>{result.confidence_label || "Prediction Confidence"}</span>
            <span>{result.confidence}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${result.confidence}%` }} />
          </div>
        </div>

        <div className="report-block">
          <h3>Screening Report</h3>
          <p>{result.report_summary}</p>

          <div className="report-meta">
            <span>Melanoma Probability: {result.melanoma_probability}%</span>
            <span>Non-Melanoma Probability: {result.non_melanoma_probability}%</span>
            {typeof result.raw_melanoma_probability === "number" && (
              <span>Raw Model Score: {result.raw_melanoma_probability}%</span>
            )}
          </div>

          {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
            <div className="recommendation-list">
              {result.recommendations.map((item) => (
                <div key={item} className="recommendation-item">
                  {item}
                </div>
              ))}
            </div>
          )}

          <p className="report-disclaimer">{result.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}

export default ResultCard;
