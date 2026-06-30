import axios from "axios";
import { useMemo, useState } from "react";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";
import {
  API_BASE_URL,
  getAuthHeaders,
  getUserTrackingKey,
  saveTrackingItem,
  formatDate,
} from "../utils";

function TrackerPage() {
  const { token, user } = useAuth();
  const trackingKey = getUserTrackingKey(user?.id);
  const [baselineFile, setBaselineFile] = useState(null);
  const [followupFile, setFollowupFile] = useState(null);
  const [baselinePreview, setBaselinePreview] = useState("");
  const [followupPreview, setFollowupPreview] = useState("");
  const [baselineDate, setBaselineDate] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedItems, setSavedItems] = useState(() =>
    JSON.parse(localStorage.getItem(trackingKey) || "[]")
  );

  const orderedMetrics = useMemo(
    () => [
      ["Area", "area_change_percent", "%"],
      ["Diameter", "diameter_change_percent", "%"],
      ["Color shift", "color_distance", ""],
      ["Color variance", "color_variance_change", ""],
      ["Asymmetry", "asymmetry_change", ""],
      ["Border", "border_change", ""],
    ],
    []
  );

  const handleFile = (file, type) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose valid image files.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setError("");
    setResult(null);

    if (type === "baseline") {
      setBaselineFile(file);
      setBaselinePreview(previewUrl);
    } else {
      setFollowupFile(file);
      setFollowupPreview(previewUrl);
    }
  };

  const runComparison = async () => {
    if (!baselineFile || !followupFile) {
      setError("Choose both baseline and follow-up lesion images.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("baseline_image", baselineFile);
      formData.append("followup_image", followupFile);

      const response = await axios.post(`${API_BASE_URL}/track-lesion`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...getAuthHeaders(token),
        },
      });

      const payload = {
        id: Date.now(),
        ...response.data,
        baselinePreview,
        followupPreview,
        baselineDate,
        followupDate,
        notes,
        createdAt: new Date().toISOString(),
      };

      setResult(payload);
      setSavedItems(saveTrackingItem(payload, user?.id));
    } catch (requestError) {
      const message =
        requestError.response?.data?.error ||
        `Could not connect to the Flask API at ${API_BASE_URL}. Start the backend server and try again.`;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Lesion Change Tracking</span>
        <h1>Compare a Lesion Over Time</h1>
        <p>
          Upload a baseline photo and a newer photo to estimate changes in size, color,
          asymmetry, and border irregularity.
        </p>
      </div>

      <div className="tracker-grid">
        <article className="card tracker-upload">
          <span>Baseline</span>
          <h3>Earlier Photo</h3>
          {baselinePreview && <img src={baselinePreview} alt="Baseline lesion" />}
          <label className="file-control">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(event) => handleFile(event.target.files?.[0], "baseline")}
            />
          </label>
          <input
            className="date-input"
            type="date"
            value={baselineDate}
            onChange={(event) => setBaselineDate(event.target.value)}
          />
        </article>

        <article className="card tracker-upload">
          <span>Follow-up</span>
          <h3>Current Photo</h3>
          {followupPreview && <img src={followupPreview} alt="Follow-up lesion" />}
          <label className="file-control">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(event) => handleFile(event.target.files?.[0], "followup")}
            />
          </label>
          <input
            className="date-input"
            type="date"
            value={followupDate}
            onChange={(event) => setFollowupDate(event.target.value)}
          />
        </article>
      </div>

      <div className="card tracker-notes">
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes: itching, bleeding, new color, pain, or anything noticed by the patient..."
        />
        <button className="button button-primary" type="button" onClick={runComparison}>
          Compare Changes
        </button>
      </div>

      {isLoading && <Loader />}
      {error && <p className="error-banner">{error}</p>}

      {result && (
        <article className="card tracker-result">
          <div>
            <span className="eyebrow">Change Score</span>
            <h2>{result.change_level}</h2>
            <strong>{result.change_score}/100</strong>
            <p>{result.summary}</p>
          </div>
          <div className="metric-grid">
            {orderedMetrics.map(([label, key, suffix]) => (
              <div className="metric-card" key={key}>
                <span>{label}</span>
                <strong>
                  {result.changes[key]}
                  {suffix}
                </strong>
              </div>
            ))}
          </div>
          {result.flags.length > 0 && (
            <div className="flag-list">
              {result.flags.map((flag) => (
                <span key={flag}>{flag}</span>
              ))}
            </div>
          )}
          <p className="report-disclaimer">{result.disclaimer}</p>
        </article>
      )}

      <div className="section-heading compact-heading">
        <span className="eyebrow">Saved Timeline</span>
        <h2>Tracked Lesions</h2>
      </div>

      {savedItems.length === 0 ? (
        <div className="card empty-state">
          <h3>No tracked changes yet</h3>
          <p>Run a comparison to build a visual timeline for this account.</p>
        </div>
      ) : (
        <div className="tracking-list">
          {savedItems.map((item) => (
            <article className="card tracking-card" key={item.id}>
              <div className="tracking-images">
                <img src={item.baselinePreview} alt="Saved baseline lesion" />
                <img src={item.followupPreview} alt="Saved follow-up lesion" />
              </div>
              <div>
                <span>{formatDate(item.createdAt)}</span>
                <h3>{item.change_level}</h3>
                <p>Score: {item.change_score}/100</p>
                <p>
                  {item.baselineDate || "Baseline date not set"} to{" "}
                  {item.followupDate || "follow-up date not set"}
                </p>
                {item.notes && <p>{item.notes}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default TrackerPage;
