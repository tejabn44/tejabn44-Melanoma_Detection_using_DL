import jsPDF from "jspdf";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
export const AUTH_TOKEN_KEY = "dermatech-auth-token";
export const AUTH_USER_KEY = "dermatech-auth-user";
export const HISTORY_KEY = "dermatech-history";
export const TRACKING_KEY = "dermatech-lesion-tracking";
export const CURRENT_RESULT_KEY = "dermatech-current-result";
export const CURRENT_HEATMAP_KEY = "dermatech-current-heatmap";

export function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getUserHistoryKey(userId) {
  return userId ? `${HISTORY_KEY}-${userId}` : HISTORY_KEY;
}

export function getUserTrackingKey(userId) {
  return userId ? `${TRACKING_KEY}-${userId}` : TRACKING_KEY;
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

export function saveHistoryItem(entry, userId) {
  const historyKey = getUserHistoryKey(userId);
  const current = JSON.parse(localStorage.getItem(historyKey) || "[]");
  const next = [entry, ...current].slice(0, 20);
  localStorage.setItem(historyKey, JSON.stringify(next));
}

export function saveTrackingItem(entry, userId) {
  const trackingKey = getUserTrackingKey(userId);
  const current = JSON.parse(localStorage.getItem(trackingKey) || "[]");
  const next = [entry, ...current].slice(0, 12);
  localStorage.setItem(trackingKey, JSON.stringify(next));
  return next;
}

export function downloadResultPdf(result) {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("AI Melanoma Detection Report", 20, 20);
  doc.setFontSize(12);
  doc.text(`Prediction: ${result.prediction}`, 20, 40);
  doc.text(`${result.confidence_label || "Confidence"}: ${result.confidence}%`, 20, 50);
  doc.text(`Risk Level: ${result.risk_level}`, 20, 60);
  doc.text(`Generated: ${formatDate(result.createdAt)}`, 20, 70);
  doc.text(`Melanoma Probability: ${result.melanoma_probability}%`, 20, 80);
  doc.text(`Non-Melanoma Probability: ${result.non_melanoma_probability}%`, 20, 90);
  doc.text(result.report_summary || "No report summary available.", 20, 105, {
    maxWidth: 170,
  });
  const recommendations = Array.isArray(result.recommendations)
    ? result.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "No recommendations available.";
  doc.text(recommendations, 20, 132, {
    maxWidth: 170,
  });
  doc.text(result.disclaimer || "This tool supports screening and is not a medical diagnosis.", 20, 175, {
    maxWidth: 170,
  });
  doc.save("melanoma-detection-report.pdf");
}
