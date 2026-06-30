import { useAuth } from "../context/AuthContext";
import { formatDate, getUserHistoryKey } from "../utils";

function HistoryPage() {
  const { user } = useAuth();
  const items = JSON.parse(localStorage.getItem(getUserHistoryKey(user?.id)) || "[]");

  return (
    <section className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Local History</span>
        <h1>Saved Results</h1>
        <p>Recent analyses for {user?.name} are stored in this browser.</p>
      </div>

      {items.length === 0 ? (
        <div className="card empty-state">
          <h3>No history yet</h3>
          <p>Run your first analysis to see saved records here.</p>
        </div>
      ) : (
        <div className="history-grid">
          {items.map((item) => (
            <article className="card history-card" key={item.id}>
              <img src={item.preview} alt={item.fileName} />
              <div>
                <h3>{item.prediction}</h3>
                <p>{item.confidence_label || "Confidence"}: {item.confidence}%</p>
                <p>Risk: {item.risk_level}</p>
                <p>{formatDate(item.createdAt)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default HistoryPage;
