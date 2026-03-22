"""
Vision pipeline — core stages.

Called by the FastAPI /process endpoint in main.py.
Models (SAM, MiDaS) are loaded once at service startup and passed in;
never re-loaded per request.
"""
import colorsys
import logging
import os
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Model paths ──────────────────────────────────────────────────────────────

_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
SAM_CHECKPOINT = os.path.join(_MODELS_DIR, "sam_vit_b_01ec64.pth")

# Maximum number of colour-mask components to pass through SAM per image.
# Each component triggers one SAM forward pass; cap keeps latency predictable.
_MAX_SAM_PROMPTS = 50


# ── Model loaders ─────────────────────────────────────────────────────────────


def load_sam_model() -> Any:
    """Load SAM ViT-B from the local checkpoint. Requires vision/models/sam_vit_b_01ec64.pth."""
    import torch
    from segment_anything import sam_model_registry

    if not os.path.exists(SAM_CHECKPOINT):
        raise FileNotFoundError(
            f"SAM checkpoint not found at {SAM_CHECKPOINT}. "
            "Run the download command in vision/README.md."
        )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    sam = sam_model_registry["vit_b"](checkpoint=SAM_CHECKPOINT)
    sam.to(device)
    sam.eval()
    logger.info("[vision] SAM ViT-B loaded on %s", device)
    return sam


def load_midas_model() -> tuple[Any, Any]:
    """Load MiDaS small via torch.hub (auto-cached in ~/.cache/torch/hub/)."""
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    midas = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", trust_repo=True)
    midas.to(device)
    midas.eval()
    transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
    logger.info("[vision] MiDaS small loaded on %s", device)
    return midas, transforms.small_transform


# ── Stage 1: Image loading ────────────────────────────────────────────────────


def _load_images(photo_urls: list[str]) -> list[np.ndarray]:
    """Download photos from S3 URLs, resize to ≤1080px longest side, return RGB arrays."""
    import urllib.request

    images: list[np.ndarray] = []
    for url in photo_urls:
        with urllib.request.urlopen(url) as resp:
            raw = np.frombuffer(resp.read(), dtype=np.uint8)
        img = cv2.imdecode(raw, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Failed to decode image from {url}")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Resize so longest side ≤ 1080px
        h, w = img.shape[:2]
        if max(h, w) > 1080:
            scale = 1080.0 / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        images.append(img)
    return images


# ── Stage 2: HSV colour segmentation ─────────────────────────────────────────


def _hex_to_opencv_hsv(hex_color: str) -> tuple[float, float, float]:
    """Return hue in [0,180], saturation in [0,255], value in [0,255] (OpenCV convention)."""
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return h * 180.0, s * 255.0, v * 255.0


def _build_colour_mask(image: np.ndarray, hex_colour: str) -> np.ndarray:
    """Binary mask of pixels within tolerance of the given hex colour."""
    h_c, s_c, v_c = _hex_to_opencv_hsv(hex_colour)
    h_tol, s_tol, v_tol = 15.0, 76.5, 76.5  # ±15° hue, ±30% sat/val

    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)

    lo = np.array([max(0.0, h_c - h_tol), max(0.0, s_c - s_tol), max(0.0, v_c - v_tol)], np.uint8)
    hi = np.array([min(180.0, h_c + h_tol), min(255.0, s_c + s_tol), min(255.0, v_c + v_tol)], np.uint8)
    mask = cv2.inRange(hsv, lo, hi)

    # Hue wraps at 180 — handle red tones spanning 0° and 180°
    if h_c - h_tol < 0:
        lo2 = np.array([180.0 + (h_c - h_tol), max(0.0, s_c - s_tol), max(0.0, v_c - v_tol)], np.uint8)
        hi2 = np.array([180.0, min(255.0, s_c + s_tol), min(255.0, v_c + v_tol)], np.uint8)
        mask = cv2.bitwise_or(mask, cv2.inRange(hsv, lo2, hi2))
    elif h_c + h_tol > 180:
        lo2 = np.array([0.0, max(0.0, s_c - s_tol), max(0.0, v_c - v_tol)], np.uint8)
        hi2 = np.array([(h_c + h_tol) - 180.0, min(255.0, s_c + s_tol), min(255.0, v_c + v_tol)], np.uint8)
        mask = cv2.bitwise_or(mask, cv2.inRange(hsv, lo2, hi2))

    return mask


# ── Stage 3: Hold instance segmentation (SAM) ────────────────────────────────


def _segment_holds(
    image: np.ndarray,
    colour_mask: np.ndarray,
    sam_model: Any,
) -> list[tuple[float, float]]:
    """
    Use SAM ViT-B to get precise hold masks from colour-mask point prompts.
    Returns pixel centroids (cx, cy) of each hold that passes area filters.
    """
    from segment_anything import SamPredictor

    predictor = SamPredictor(sam_model)
    predictor.set_image(image)  # runs SAM encoder once per image

    h, w = image.shape[:2]
    image_area = h * w

    # Connected components of the colour mask → one point prompt per component
    num_labels, _, stats, centroids_cv = cv2.connectedComponentsWithStats(colour_mask)

    hold_centroids: list[tuple[float, float]] = []

    # Sort components by area descending, skip background (label 0)
    label_ids = sorted(range(1, num_labels), key=lambda i: stats[i, cv2.CC_STAT_AREA], reverse=True)

    for label_id in label_ids[:_MAX_SAM_PROMPTS]:
        area = stats[label_id, cv2.CC_STAT_AREA]
        if area < 400:
            break  # remaining components are smaller (sorted desc)

        cx = float(centroids_cv[label_id, 0])
        cy = float(centroids_cv[label_id, 1])

        masks, scores, _ = predictor.predict(
            point_coords=np.array([[cx, cy]]),
            point_labels=np.array([1]),
            multimask_output=True,
        )

        best_mask = masks[int(np.argmax(scores))]
        mask_area = int(np.sum(best_mask))

        if mask_area < 400 or mask_area > image_area * 0.15:
            continue

        M = cv2.moments(best_mask.astype(np.uint8))
        if M["m00"] == 0:
            continue
        hold_centroids.append((M["m10"] / M["m00"], M["m01"] / M["m00"]))

    return hold_centroids


# ── Stage 4: Wall boundary detection ─────────────────────────────────────────


def _detect_wall_bbox(image: np.ndarray) -> dict[str, int]:
    """
    Detect the climbing wall's bounding box using Canny edges + Hough lines.
    Falls back to the full image frame if detection fails.
    Returns pixel-space {x, y, w, h}.
    """
    h, w = image.shape[:2]
    fallback = {"x": 0, "y": 0, "w": w, "h": h}

    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=50, maxLineGap=10)

    if lines is None:
        return fallback

    pts = lines.reshape(-1, 4)
    xs = np.concatenate([pts[:, 0], pts[:, 2]])
    ys = np.concatenate([pts[:, 1], pts[:, 3]])

    x1 = int(np.percentile(xs, 5))
    y1 = int(np.percentile(ys, 5))
    x2 = int(np.percentile(xs, 95))
    y2 = int(np.percentile(ys, 95))

    bw, bh = x2 - x1, y2 - y1
    if bw < 10 or bh < 10:
        return fallback

    return {"x": x1, "y": y1, "w": bw, "h": bh}


# ── Stage 5: Coordinate normalisation ────────────────────────────────────────


def _normalise(
    centroids: list[tuple[float, float]],
    bbox: dict[str, int],
    img_shape: tuple[int, int],
) -> list[tuple[float, float]]:
    """
    Normalise pixel centroids to [0, 1] relative to wall_bbox.
    y is inverted so 0 = floor, 1 = top of wall.
    """
    img_h, img_w = img_shape
    bx = bbox["x"]
    by = bbox["y"]
    bw = bbox["w"] or img_w
    bh = bbox["h"] or img_h

    result: list[tuple[float, float]] = []
    for cx, cy in centroids:
        xn = max(0.0, min(1.0, (cx - bx) / bw))
        yn = max(0.0, min(1.0, 1.0 - (cy - by) / bh))
        result.append((xn, yn))
    return result


# ── Deduplication ─────────────────────────────────────────────────────────────


def _deduplicate(centroids: list[tuple[float, float]], threshold: float = 0.03) -> list[tuple[float, float]]:
    """
    Remove duplicate centroids from multiple photos of the same wall.
    Two centroids are considered the same hold if their Euclidean distance < threshold
    (in normalised [0, 1] space — 3% corresponds to ~30px on a 1000px image).
    """
    unique: list[tuple[float, float]] = []
    for cx, cy in centroids:
        if not any((cx - ux) ** 2 + (cy - uy) ** 2 < threshold ** 2 for ux, uy in unique):
            unique.append((cx, cy))
    return unique


# ── Stage 5 cont.: Build hold_vector ─────────────────────────────────────────


def _build_hold_vector(centroids: list[tuple[float, float]]) -> list[float]:
    """
    Sort holds top→bottom (y_norm descending), flatten to [x1,y1,x2,y2,...],
    zero-pad to 200 dims (100 holds × 2 floats).
    """
    sorted_holds = sorted(centroids, key=lambda c: c[1], reverse=True)
    flat = [coord for cx, cy in sorted_holds for coord in (cx, cy)]
    flat += [0.0] * (200 - len(flat))
    return flat[:200]


# ── Main pipeline entry point ─────────────────────────────────────────────────


def process_upload(
    upload_id: str,
    photo_urls: list[str],
    colour: str,
    gym_id: str,
    sam_model: Any,
    midas_model: Any,
    midas_transform: Any,
) -> dict[str, Any]:
    """
    Run the full 7-stage pipeline and return the result dict consumed by /process.

    Stages:
      1. Load + normalise images
      2. HSV colour segmentation
      3. SAM hold instance segmentation
      4. Wall boundary detection
      5. Coordinate normalisation + deduplication
      6. Depth estimation (TODO — skipped for MVP)
      7. Return result
    """
    logger.info("[pipeline] start upload=%s gym=%s colour=%s", upload_id, gym_id, colour)

    # Stage 1
    try:
        images = _load_images(photo_urls)
    except Exception as exc:
        raise RuntimeError("stage_1_failed") from exc

    all_norm_centroids: list[tuple[float, float]] = []
    wall_bbox: dict[str, int] | None = None

    for img in images:
        img_h, img_w = img.shape[:2]

        # Stage 2
        try:
            colour_mask = _build_colour_mask(img, colour)
        except Exception as exc:
            raise RuntimeError("stage_2_failed") from exc

        # Stage 3
        try:
            px_centroids = _segment_holds(img, colour_mask, sam_model)
        except Exception as exc:
            raise RuntimeError("stage_3_failed") from exc

        # Stage 4 (use first image's bbox as representative)
        if wall_bbox is None:
            try:
                wall_bbox = _detect_wall_bbox(img)
            except Exception as exc:
                raise RuntimeError("stage_4_failed") from exc

        # Stage 5: normalise this image's centroids
        norm = _normalise(px_centroids, wall_bbox, (img_h, img_w))
        all_norm_centroids.extend(norm)

    if wall_bbox is None:
        h, w = images[0].shape[:2] if images else (1080, 1080)
        wall_bbox = {"x": 0, "y": 0, "w": w, "h": h}

    # Deduplicate across photos
    deduped = _deduplicate(all_norm_centroids)

    # Stage 5 cont.: build padded vector
    hold_vector = _build_hold_vector(deduped)
    hold_count = len(deduped)

    # Normalise bbox to relative coords for the response
    ref_h, ref_w = images[0].shape[:2] if images else (1080, 1080)
    wall_bbox_norm = {
        "x": wall_bbox["x"] / ref_w,
        "y": wall_bbox["y"] / ref_h,
        "w": wall_bbox["w"] / ref_w,
        "h": wall_bbox["h"] / ref_h,
    }

    # Stage 6: depth estimation — TODO (requires 3+ photos; skip for MVP)

    logger.info("[pipeline] done upload=%s holds=%d", upload_id, hold_count)
    return {
        "hold_vector": hold_vector,
        "hold_count": hold_count,
        "wall_bbox": wall_bbox_norm,
        "debug_image_url": None,  # TODO: annotated overlay stored in S3
    }
