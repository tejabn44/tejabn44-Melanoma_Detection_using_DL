import { Link, Navigate } from "react-router-dom";
import ResultCard from "../components/ResultCard";
import { CURRENT_HEATMAP_KEY, CURRENT_RESULT_KEY, downloadResultPdf } from "../utils";

function ResultsPage() {
  const result = JSON.parse(localStorage.getItem(CURRENT_RESULT_KEY) || "null");
  const heatmap = JSON.parse(localStorage.getItem(CURRENT_HEATMAP_KEY) || "null");

  if (!result) {
    return <Navigate to="/upload" replace />;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Analysis Result</span>
        <h1>Detection Summary</h1>
        <p>Review the confidence score and risk category for the uploaded lesion image.</p>
      </div>

      <ResultCard result={result} imageUrl={result.preview} />

      <div className="action-row">
        {heatmap ? (
          <Link className="button button-primary" to="/heatmap">
            View Heatmap
          </Link>
        ) : (
          <span className="heatmap-note">Heatmap unavailable for this scan.</span>
        )}
        <button
          className="button button-secondary"
          type="button"
          onClick={() => downloadResultPdf(result)}
        >
          Download PDF
        </button>
      </div>
    </section>
  );
}

export default ResultsPage;
