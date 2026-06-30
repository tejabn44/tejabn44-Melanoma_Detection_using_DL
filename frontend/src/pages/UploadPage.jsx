import axios from "axios";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";
import {
  API_BASE_URL,
  CURRENT_HEATMAP_KEY,
  CURRENT_RESULT_KEY,
  getAuthHeaders,
  saveHistoryItem,
} from "../utils";

function UploadPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFile = (selectedFile) => {
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    setError("");
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Select an image before starting the analysis.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const predictFormData = new FormData();
      predictFormData.append("image", file);
      const predictResponse = await axios.post(`${API_BASE_URL}/predict`, predictFormData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...getAuthHeaders(token),
        },
      });

      const resultPayload = {
        ...predictResponse.data,
        preview,
        fileName: file.name,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(CURRENT_RESULT_KEY, JSON.stringify(resultPayload));
      saveHistoryItem({
        id: Date.now(),
        preview,
        prediction: resultPayload.prediction,
        confidence: resultPayload.confidence,
        confidence_label: resultPayload.confidence_label,
        risk_level: resultPayload.risk_level,
        createdAt: resultPayload.createdAt,
        fileName: resultPayload.fileName,
      }, user?.id);

      try {
        const heatmapFormData = new FormData();
        heatmapFormData.append("image", file);

        const heatmapResponse = await axios.post(`${API_BASE_URL}/heatmap`, heatmapFormData, {
          headers: {
            "Content-Type": "multipart/form-data",
            ...getAuthHeaders(token),
          },
        });

        const heatmapPayload = {
          ...heatmapResponse.data,
          preview,
        };

        localStorage.setItem(CURRENT_HEATMAP_KEY, JSON.stringify(heatmapPayload));
      } catch (heatmapError) {
        localStorage.removeItem(CURRENT_HEATMAP_KEY);
      }

      navigate("/results");
    } catch (requestError) {
      let message = requestError.response?.data?.error;

      if (!message && !requestError.response) {
        message = `Could not connect to the Flask API at ${API_BASE_URL}. Start the backend server and try again.`;
      }

      if (!message) {
        message = "Analysis failed while processing the uploaded image.";
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Upload Image</span>
        <h1>Analyze a Skin Lesion</h1>
        <p>Drag and drop an image or choose one from your device.</p>
      </div>

      <div
        className={`upload-zone card ${isDragActive ? "drag-active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/jpg"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />

        <h2>Drop lesion image here</h2>
        <p>PNG, JPG, and JPEG files are supported.</p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          Choose Image
        </button>
      </div>

      {preview && (
        <div className="card preview-card">
          <img src={preview} alt="Lesion preview" className="preview-image" />
          <div className="preview-meta">
            <h3>{file?.name}</h3>
            <p>Preview your uploaded image before sending it to the model.</p>
            <button className="button button-accent" type="button" onClick={handleAnalyze}>
              Analyze
            </button>
          </div>
        </div>
      )}

      {isLoading && <Loader />}
      {error && <p className="error-banner">{error}</p>}
    </section>
  );
}

export default UploadPage;
