import base64
import io
import json
import os
import re
import secrets
from datetime import datetime
from functools import wraps
from threading import Lock

import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageOps
from tensorflow.keras.models import load_model
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = "https://drive.google.com/drive/folders/1cj82l8hoisq8Rq3hQGSH2Hx2Yf-oh3wh?usp=drive_link"
AUTH_STORE_PATH = os.path.join(BASE_DIR, "auth_store.json")
IMAGE_SIZE = (224, 224)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
LAST_CONV_LAYER = "conv5_block3_out"
MELANOMA_CLASS_INDEX = 0
MIN_SKIN_LIKE_FRACTION = 0.03
MIN_SKIN_COMPONENT_FRACTION = 0.03
MIN_LUMINANCE_STD = 6.0
MAX_DISPLAY_CONFIDENCE = 0.985
MIN_DISPLAY_CONFIDENCE = 0.55
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
CORS(app)

_model_lock = Lock()
_model = None
_last_conv_model = None
_classifier_model = None
_auth_lock = Lock()


def empty_auth_store():
    return {"users": [], "sessions": {}}


def load_auth_store():
    if not os.path.exists(AUTH_STORE_PATH):
        return empty_auth_store()

    try:
        with open(AUTH_STORE_PATH, "r", encoding="utf-8") as file:
            store = json.load(file)
    except (json.JSONDecodeError, OSError):
        return empty_auth_store()

    store.setdefault("users", [])
    store.setdefault("sessions", {})
    return store


def save_auth_store(store):
    with open(AUTH_STORE_PATH, "w", encoding="utf-8") as file:
        json.dump(store, file, indent=2)


def public_user(user):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "created_at": user["created_at"],
    }


def find_user_by_email(store, email):
    normalized_email = email.strip().lower()
    return next((user for user in store["users"] if user["email"] == normalized_email), None)


def find_user_by_id(store, user_id):
    return next((user for user in store["users"] if user["id"] == user_id), None)


def get_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return ""
    return auth_header.removeprefix("Bearer ").strip()


def get_authenticated_user():
    token = get_bearer_token()
    if not token:
        return None

    with _auth_lock:
        store = load_auth_store()
        user_id = store["sessions"].get(token)
        if not user_id:
            return None
        return find_user_by_id(store, user_id)


def login_required(route):
    @wraps(route)
    def wrapped(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            return jsonify({"error": "Please log in to continue."}), 401
        request.current_user = user
        return route(*args, **kwargs)

    return wrapped


def create_session(store, user_id):
    token = secrets.token_urlsafe(32)
    store["sessions"][token] = user_id
    return token


def validate_auth_payload(data, require_name=False):
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()

    if require_name and len(name) < 2:
        return "Please enter your name."
    if not EMAIL_RE.match(email):
        return "Please enter a valid email address."
    if len(password) < 6:
        return "Password must be at least 6 characters long."
    return ""


def get_model_bundle():
    global _model, _last_conv_model, _classifier_model

    if _model is not None:
        return _model, _last_conv_model, _classifier_model

    with _model_lock:
        if _model is None:
            model = load_model(MODEL_PATH, compile=False)
            last_conv_layer = model.get_layer(LAST_CONV_LAYER)

            _model = model
            _last_conv_model = tf.keras.Model(
                inputs=model.inputs,
                outputs=[last_conv_layer.output, model.output],
            )
            _classifier_model = None

    return _model, _last_conv_model, _classifier_model


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def load_uploaded_image():
    if "image" not in request.files:
        raise ValueError("No image file was provided.")

    file = request.files["image"]
    if not file or not file.filename:
        raise ValueError("Please choose an image file.")

    if not allowed_file(file.filename):
        raise ValueError("Only PNG, JPG, and JPEG files are supported.")

    try:
        image = Image.open(file.stream).convert("RGB")
    except Exception as exc:
        raise ValueError("The uploaded file could not be read as an image.") from exc

    return image, file.filename


def load_named_uploaded_image(field_name, label):
    if field_name not in request.files:
        raise ValueError(f"No {label} image was provided.")

    file = request.files[field_name]
    if not file or not file.filename:
        raise ValueError(f"Please choose a {label} image.")

    if not allowed_file(file.filename):
        raise ValueError("Only PNG, JPG, and JPEG files are supported.")

    try:
        image = Image.open(file.stream).convert("RGB")
    except Exception as exc:
        raise ValueError(f"The {label} file could not be read as an image.") from exc

    return image, file.filename


def prepare_image(image):
    resized = image.resize(IMAGE_SIZE)
    image_array = np.array(resized, dtype=np.float32)
    batch = np.expand_dims(image_array / 255.0, axis=0)
    return batch, image_array


def get_risk_level(probability):
    if probability >= 0.85:
        return "Very High"
    if probability >= 0.65:
        return "High"
    if probability >= 0.4:
        return "Moderate"
    return "Low"


def build_report(prediction, probability, image_metrics):
    display_confidence = get_display_confidence(probability, image_metrics)

    if prediction == "melanoma":
        melanoma_probability = round(display_confidence * 100, 2)
        non_melanoma_probability = round((1 - display_confidence) * 100, 2)
    else:
        non_melanoma_probability = round(display_confidence * 100, 2)
        melanoma_probability = round((1 - display_confidence) * 100, 2)

    confidence = melanoma_probability if prediction == "melanoma" else non_melanoma_probability
    risk_level = get_risk_level(probability)
    raw_melanoma_probability = round(probability * 100, 2)

    if prediction == "melanoma":
        summary = (
            "The uploaded lesion image shows a pattern that the trained model associates "
            "with melanoma. Prompt clinical review is recommended."
        )
        recommendations = [
            "Arrange a dermatologist consultation as soon as possible.",
            "Avoid relying on this screening result as a diagnosis without medical confirmation.",
            "Track any visible changes in color, size, border shape, or symptoms such as bleeding or itching.",
        ]
    else:
        summary = (
            "The uploaded lesion image is more consistent with a non-melanoma pattern in this model. "
            "Continue monitoring the lesion and seek medical advice if it changes."
        )
        recommendations = [
            "Monitor the lesion for changes in asymmetry, border, color, diameter, or evolution.",
            "Seek medical review if the lesion starts changing rapidly or causes symptoms.",
            "Use this result for screening support only, not as a final diagnosis.",
        ]

    return {
        "prediction": prediction,
        "confidence": confidence,
        "risk_level": risk_level,
        "melanoma_probability": melanoma_probability,
        "non_melanoma_probability": non_melanoma_probability,
        "raw_melanoma_probability": raw_melanoma_probability,
        "confidence_label": "Screening Confidence",
        "report_summary": summary,
        "recommendations": recommendations,
        "disclaimer": "This AI result is for screening support only and is not a medical diagnosis.",
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


def make_prediction(image):
    image_metrics = validate_skin_image(image)
    model, _, _ = get_model_bundle()
    processed_batch, _ = prepare_image(image)
    probability = get_melanoma_probability(model.predict(processed_batch, verbose=0)[0])
    prediction = "melanoma" if probability >= 0.5 else "non-melanoma"
    return build_report(prediction, probability, image_metrics)


def get_melanoma_probability(prediction_values):
    prediction_array = np.asarray(prediction_values, dtype=np.float32).reshape(-1)

    if prediction_array.size == 1:
        return float(prediction_array[0])

    if np.any(prediction_array < 0) or not np.isclose(prediction_array.sum(), 1.0, atol=1e-3):
        prediction_array = tf.nn.softmax(prediction_array).numpy()

    class_index = min(MELANOMA_CLASS_INDEX, prediction_array.size - 1)
    return float(prediction_array[class_index])


def validate_skin_image(image):
    metrics = get_skin_image_metrics(image)
    has_skin_region = (
        metrics["skin_like_fraction"] >= MIN_SKIN_LIKE_FRACTION
        and metrics["largest_skin_component_fraction"] >= MIN_SKIN_COMPONENT_FRACTION
    )
    has_enough_detail = metrics["luminance_std"] >= MIN_LUMINANCE_STD

    if not (has_skin_region and has_enough_detail):
        raise ValueError(
            "Please upload a clear skin lesion image. Non-skin or very low-detail images "
            "cannot be screened by this model."
        )

    return metrics


def get_display_confidence(probability, image_metrics):
    raw_confidence = max(float(probability), 1 - float(probability))
    model_margin = np.clip((raw_confidence - 0.5) * 2, 0, 1)
    quality_score = get_image_quality_score(image_metrics)
    display_confidence = 0.58 + 0.32 * np.sqrt(model_margin) + 0.08 * quality_score
    return float(np.clip(display_confidence, MIN_DISPLAY_CONFIDENCE, MAX_DISPLAY_CONFIDENCE))


def get_image_quality_score(metrics):
    skin_score = scaled_score(metrics["skin_like_fraction"], MIN_SKIN_LIKE_FRACTION, 0.45)
    component_score = scaled_score(
        metrics["largest_skin_component_fraction"], MIN_SKIN_COMPONENT_FRACTION, 0.25
    )
    detail_score = scaled_score(metrics["luminance_std"], MIN_LUMINANCE_STD, 45.0)
    return float(0.4 * skin_score + 0.35 * component_score + 0.25 * detail_score)


def scaled_score(value, low, high):
    if high <= low:
        return 0.0
    return float(np.clip((value - low) / (high - low), 0, 1))


def get_skin_image_metrics(image):
    resized = image.resize(IMAGE_SIZE)
    rgb = np.array(resized, dtype=np.float32)
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]
    max_channel = np.max(rgb, axis=2)
    min_channel = np.min(rgb, axis=2)

    skin_mask = (
        (r > 45)
        & (g > 34)
        & (b > 20)
        & ((max_channel - min_channel) > 15)
        & (np.abs(r - g) > 5)
        & (r > g)
        & (r > b)
    )
    luminance = 0.299 * r + 0.587 * g + 0.114 * b

    return {
        "skin_like_fraction": float(skin_mask.mean()),
        "largest_skin_component_fraction": largest_component_fraction(skin_mask[::2, ::2]),
        "luminance_std": float(luminance.std()),
    }


def largest_component_fraction(mask):
    if mask.size == 0 or not mask.any():
        return 0.0

    visited = np.zeros(mask.shape, dtype=bool)
    height, width = mask.shape
    largest = 0

    for y in range(height):
        for x in range(width):
            if visited[y, x] or not mask[y, x]:
                continue

            stack = [(y, x)]
            visited[y, x] = True
            size = 0

            while stack:
                current_y, current_x = stack.pop()
                size += 1

                for next_y, next_x in (
                    (current_y - 1, current_x),
                    (current_y + 1, current_x),
                    (current_y, current_x - 1),
                    (current_y, current_x + 1),
                ):
                    if (
                        0 <= next_y < height
                        and 0 <= next_x < width
                        and not visited[next_y, next_x]
                        and mask[next_y, next_x]
                    ):
                        visited[next_y, next_x] = True
                        stack.append((next_y, next_x))

            largest = max(largest, size)

    return float(largest / mask.size)


def array_to_base64(image_array):
    image = Image.fromarray(image_array)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def extract_lesion_metrics(image):
    resized = image.resize(IMAGE_SIZE)
    rgb = np.array(resized, dtype=np.float32)
    luminance = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    threshold = np.percentile(luminance, 35)
    mask = luminance <= threshold

    if mask.sum() < 40:
        mask = luminance <= np.percentile(luminance, 45)

    coords = np.argwhere(mask)
    if coords.size == 0:
        return {
            "area_fraction": 0,
            "diameter_pixels": 0,
            "color_variance": 0,
            "mean_color": [0, 0, 0],
            "asymmetry": 0,
            "border_irregularity": 0,
        }

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    width = max(int(x_max - x_min + 1), 1)
    height = max(int(y_max - y_min + 1), 1)
    lesion_pixels = rgb[mask]
    area_fraction = float(mask.mean())
    diameter_pixels = float((width + height) / 2)
    mean_color = lesion_pixels.mean(axis=0)
    color_variance = float(lesion_pixels.std(axis=0).mean())

    cropped_mask = mask[y_min : y_max + 1, x_min : x_max + 1]
    flipped_horizontal = np.fliplr(cropped_mask)
    flipped_vertical = np.flipud(cropped_mask)
    asymmetry = float(
        (
            np.logical_xor(cropped_mask, flipped_horizontal).mean()
            + np.logical_xor(cropped_mask, flipped_vertical).mean()
        )
        / 2
    )

    padded = np.pad(mask, 1, mode="constant", constant_values=False)
    neighbors = (
        padded[1:-1, :-2]
        + padded[1:-1, 2:]
        + padded[:-2, 1:-1]
        + padded[2:, 1:-1]
    )
    border_pixels = mask & (neighbors < 4)
    border_irregularity = float(border_pixels.sum() / max(mask.sum(), 1))

    return {
        "area_fraction": round(area_fraction, 5),
        "diameter_pixels": round(diameter_pixels, 2),
        "color_variance": round(color_variance, 2),
        "mean_color": [round(float(value), 2) for value in mean_color],
        "asymmetry": round(asymmetry, 4),
        "border_irregularity": round(border_irregularity, 4),
    }


def percent_change(before, after):
    if before == 0:
        return 0 if after == 0 else 100
    return round(((after - before) / before) * 100, 2)


def compare_lesion_images(baseline_image, followup_image):
    baseline = extract_lesion_metrics(baseline_image)
    followup = extract_lesion_metrics(followup_image)
    color_distance = float(
        np.linalg.norm(np.array(followup["mean_color"]) - np.array(baseline["mean_color"]))
    )

    changes = {
        "area_change_percent": percent_change(baseline["area_fraction"], followup["area_fraction"]),
        "diameter_change_percent": percent_change(
            baseline["diameter_pixels"], followup["diameter_pixels"]
        ),
        "color_distance": round(color_distance, 2),
        "color_variance_change": round(followup["color_variance"] - baseline["color_variance"], 2),
        "asymmetry_change": round(followup["asymmetry"] - baseline["asymmetry"], 4),
        "border_change": round(
            followup["border_irregularity"] - baseline["border_irregularity"], 4
        ),
    }

    flags = []
    if changes["area_change_percent"] >= 12 or changes["diameter_change_percent"] >= 8:
        flags.append("Visible size increase")
    if changes["color_distance"] >= 18 or changes["color_variance_change"] >= 8:
        flags.append("Color distribution changed")
    if changes["asymmetry_change"] >= 0.04:
        flags.append("Asymmetry increased")
    if changes["border_change"] >= 0.025:
        flags.append("Border irregularity increased")

    score = min(
        100,
        round(
            abs(changes["area_change_percent"]) * 0.45
            + abs(changes["diameter_change_percent"]) * 0.35
            + changes["color_distance"] * 0.7
            + max(changes["asymmetry_change"], 0) * 140
            + max(changes["border_change"], 0) * 180,
            1,
        ),
    )

    if score >= 45 or len(flags) >= 3:
        level = "High Change"
    elif score >= 22 or flags:
        level = "Moderate Change"
    else:
        level = "Low Change"

    return {
        "baseline_metrics": baseline,
        "followup_metrics": followup,
        "changes": changes,
        "change_score": score,
        "change_level": level,
        "flags": flags,
        "summary": (
            "Noticeable evolution was detected. A dermatologist should review this lesion."
            if level == "High Change"
            else "Some measurable change was detected. Continue tracking and seek clinical review if it persists."
            if level == "Moderate Change"
            else "The two images look broadly stable by this image-comparison check."
        ),
        "disclaimer": "Change tracking is a monitoring aid only and is not a medical diagnosis.",
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


def generate_gradcam(image):
    validate_skin_image(image)
    _, grad_model, _ = get_model_bundle()
    processed_batch, _ = prepare_image(image)

    with tf.GradientTape() as tape:
        conv_output, predictions = grad_model(processed_batch, training=False)
        tape.watch(conv_output)
        if predictions.shape[-1] == 1:
            target = predictions[:, 0]
        else:
            target = predictions[:, min(MELANOMA_CLASS_INDEX, int(predictions.shape[-1]) - 1)]

    gradients = tape.gradient(target, conv_output)
    pooled_gradients = tf.reduce_mean(gradients, axis=(0, 1, 2))
    conv_output = conv_output[0]
    heatmap = tf.reduce_sum(conv_output * pooled_gradients, axis=-1)
    heatmap = tf.maximum(heatmap, 0)

    max_value = tf.reduce_max(heatmap)
    if float(max_value) == 0.0:
        heatmap = tf.zeros_like(heatmap)
    else:
        heatmap = heatmap / max_value

    heatmap_array = np.uint8(255 * heatmap.numpy())
    heatmap_image = Image.fromarray(heatmap_array, mode="L").resize(image.size)
    colored_heatmap = ImageOps.colorize(heatmap_image, black="#120b1f", white="#ff6b00")
    blended = Image.blend(image.convert("RGB"), colored_heatmap, alpha=0.45)

    return array_to_base64(np.array(blended, dtype=np.uint8))


@app.get("/health")
def health_check():
    model_ready = os.path.exists(MODEL_PATH)
    return jsonify(
        {
            "status": "ok",
            "model_ready": model_ready,
            "model_name": os.path.basename(MODEL_PATH),
        }
    )


@app.post("/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    validation_error = validate_auth_payload(data, require_name=True)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    email = data["email"].strip().lower()
    name = data["name"].strip()

    with _auth_lock:
        store = load_auth_store()
        if find_user_by_email(store, email):
            return jsonify({"error": "An account with this email already exists."}), 409

        user = {
            "id": secrets.token_urlsafe(12),
            "name": name,
            "email": email,
            "password_hash": generate_password_hash(data["password"]),
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        token = create_session(store, user["id"])
        store["users"].append(user)
        save_auth_store(store)

    return jsonify({"token": token, "user": public_user(user)}), 201


@app.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    validation_error = validate_auth_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    email = data["email"].strip().lower()

    with _auth_lock:
        store = load_auth_store()
        user = find_user_by_email(store, email)
        if not user or not check_password_hash(user["password_hash"], data["password"]):
            return jsonify({"error": "Invalid email or password."}), 401

        token = create_session(store, user["id"])
        save_auth_store(store)

    return jsonify({"token": token, "user": public_user(user)})


@app.post("/auth/logout")
@login_required
def logout():
    token = get_bearer_token()
    with _auth_lock:
        store = load_auth_store()
        store["sessions"].pop(token, None)
        save_auth_store(store)

    return jsonify({"message": "Logged out successfully."})


@app.get("/auth/me")
@login_required
def me():
    return jsonify({"user": public_user(request.current_user)})


@app.post("/predict")
@login_required
def predict():
    try:
        image, filename = load_uploaded_image()
        result = make_prediction(image)
        result["file_name"] = filename
        result["user_id"] = request.current_user["id"]
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Prediction failed: {exc}"}), 500


@app.post("/heatmap")
@login_required
def heatmap():
    try:
        image, filename = load_uploaded_image()
        heatmap_base64 = generate_gradcam(image)
        return jsonify(
            {
                "file_name": filename,
                "heatmap_base64": heatmap_base64,
                "user_id": request.current_user["id"],
            }
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Heatmap generation failed: {exc}"}), 500


@app.post("/track-lesion")
@login_required
def track_lesion():
    try:
        baseline_image, baseline_filename = load_named_uploaded_image("baseline_image", "baseline")
        followup_image, followup_filename = load_named_uploaded_image("followup_image", "follow-up")
        result = compare_lesion_images(baseline_image, followup_image)
        result["baseline_file_name"] = baseline_filename
        result["followup_file_name"] = followup_filename
        result["user_id"] = request.current_user["id"]
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Lesion tracking failed: {exc}"}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
