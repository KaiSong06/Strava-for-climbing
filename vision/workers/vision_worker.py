"""
Vision pipeline — core stages.

Called by the FastAPI /process endpoint in main.py.
Models (SAM, MiDaS) are loaded once at service startup and passed in;
never re-loaded per request.
"""
import base64
import colorsys
import io
import logging
import os
from typing import Any

import cv2
import numpy as np
import sentry_sdk

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
    logger.info("vision.sam_loaded", extra={"device": device})
    return sam


def load_midas_model() -> tuple[Any, Any]:
    """Load MiDaS small via torch.hub (auto-cached in ~/.cache/torch/hub/)."""
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    midas = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", trust_repo=True)
    midas.to(device)
    midas.eval()
    transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
    logger.info("vision.midas_loaded", extra={"device": device})
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


# ── Stage 6: Depth estimation ────────────────────────────────────────────────


def _run_midas_depth(
    image: np.ndarray,
    midas_model: Any,
    midas_transform: Any,
) -> np.ndarray:
    """
    Run MiDaS small on a single image and return a normalised [0,1] depth map.
    The depth map has the same spatial dimensions as the input image.
    """
    import torch

    device = next(midas_model.parameters()).device

    input_batch = midas_transform(image).to(device)
    with torch.no_grad():
        prediction = midas_model(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=image.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth = prediction.cpu().numpy()

    # Normalise to [0, 1]
    d_min, d_max = depth.min(), depth.max()
    if d_max - d_min > 1e-6:
        depth = (depth - d_min) / (d_max - d_min)
    else:
        depth = np.zeros_like(depth)

    return depth.astype(np.float32)


# ── Stage 6b: GLB mesh generation ────────────────────────────────────────────


def _hex_to_rgb_floats(hex_color: str) -> tuple[float, float, float]:
    """Convert '#RRGGBB' to (r, g, b) floats in [0, 1]."""
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return r, g, b


def _generate_glb_model(
    image: np.ndarray,
    depth_map: np.ndarray,
    hold_centroids: list[tuple[float, float]],
    wall_bbox: dict[str, int],
    hold_colour_hex: str,
) -> bytes:
    """
    Generate a GLB mesh from the depth map and wall photo.

    Creates a relief mesh where depth pushes vertices forward,
    UV-maps the photo texture onto the surface, and adds small
    sphere markers at each detected hold position.

    Returns the GLB binary.
    """
    import trimesh

    h, w = depth_map.shape[:2]
    bx, by, bw, bh = wall_bbox["x"], wall_bbox["y"], wall_bbox["w"], wall_bbox["h"]

    # Crop image and depth to wall bbox
    crop_y1 = max(0, by)
    crop_y2 = min(h, by + bh)
    crop_x1 = max(0, bx)
    crop_x2 = min(w, bx + bw)

    wall_img = image[crop_y1:crop_y2, crop_x1:crop_x2]
    wall_depth = depth_map[crop_y1:crop_y2, crop_x1:crop_x2]

    wh, ww = wall_img.shape[:2]
    if wh < 4 or ww < 4:
        raise ValueError("Wall crop too small for mesh generation")

    # Subsample to ~270 max dimension (every Nth pixel)
    step = max(1, max(wh, ww) // 270)
    grid_y = np.arange(0, wh, step)
    grid_x = np.arange(0, ww, step)
    gy, gx = np.meshgrid(grid_y, grid_x, indexing="ij")

    rows, cols = gy.shape
    depth_samples = wall_depth[gy, gx]

    # Relief scale — controls how "deep" the 3D effect looks
    relief_scale = 0.1

    # Build vertices: x in [0, aspect], y in [0, 1], z = depth * relief
    aspect = ww / wh
    vertices = np.zeros((rows * cols, 3), dtype=np.float32)
    uvs = np.zeros((rows * cols, 2), dtype=np.float32)

    for r in range(rows):
        for c in range(cols):
            idx = r * cols + c
            x_norm = gx[r, c] / ww
            y_norm = gy[r, c] / wh
            vertices[idx] = [
                x_norm * aspect,
                (1.0 - y_norm),  # flip y so bottom of wall is y=0
                depth_samples[r, c] * relief_scale,
            ]
            uvs[idx] = [x_norm, y_norm]

    # Build triangle faces from grid
    faces = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            tl = r * cols + c
            tr = r * cols + (c + 1)
            bl = (r + 1) * cols + c
            br = (r + 1) * cols + (c + 1)
            faces.append([tl, bl, tr])
            faces.append([tr, bl, br])

    faces_arr = np.array(faces, dtype=np.int64)

    # Create texture from wall crop (512x512 JPEG, quality 70)
    from PIL import Image as PILImage

    tex_img = PILImage.fromarray(wall_img)
    tex_img = tex_img.resize((512, 512), PILImage.LANCZOS)
    tex_buf = io.BytesIO()
    tex_img.save(tex_buf, format="JPEG", quality=70)
    tex_buf.seek(0)

    # Create trimesh PBR material with texture
    material = trimesh.visual.material.PBRMaterial(
        baseColorTexture=PILImage.open(tex_buf),
        metallicFactor=0.0,
        roughnessFactor=0.6,
    )

    # Assign UV visual
    wall_mesh = trimesh.Trimesh(
        vertices=vertices,
        faces=faces_arr,
        process=False,
    )
    wall_mesh.visual = trimesh.visual.TextureVisuals(
        uv=uvs,
        material=material,
    )

    # Build scene with wall mesh
    scene = trimesh.Scene()
    scene.add_geometry(wall_mesh, node_name="wall_mesh")

    # Add hold markers as small spheres
    hr, hg, hb = _hex_to_rgb_floats(hold_colour_hex)
    hold_material = trimesh.visual.material.PBRMaterial(
        baseColorFactor=[int(hr * 255), int(hg * 255), int(hb * 255), 255],
        metallicFactor=0.3,
        roughnessFactor=0.2,
        emissiveFactor=[int(hr * 200), int(hg * 200), int(hb * 200)],
    )

    for i, (cx, cy) in enumerate(hold_centroids):
        # cx, cy are normalised [0,1] relative to wall bbox
        # Map to mesh coordinate space
        px = int(cx * ww)
        py = int((1.0 - cy) * wh)  # cy is inverted (0=floor, 1=top)
        px = max(0, min(ww - 1, px))
        py = max(0, min(wh - 1, py))

        z = float(wall_depth[py, px]) * relief_scale + 0.01  # slightly in front
        sphere = trimesh.creation.icosphere(subdivisions=2, radius=0.012)
        sphere.apply_translation([cx * aspect, cy, z])
        sphere.visual = trimesh.visual.TextureVisuals(material=hold_material)
        scene.add_geometry(sphere, node_name=f"hold_{i}")

    # Export to GLB
    glb_bytes: bytes = scene.export(file_type="glb")
    return glb_bytes


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
    log_ctx = {"upload_id": upload_id, "gym_id": gym_id, "colour": colour}
    logger.info("vision.pipeline.start", extra=log_ctx)

    def _fail(stage: str, exc: Exception) -> RuntimeError:
        """Tag Sentry with stage context before re-raising as a stage_N_failed RuntimeError."""
        sentry_sdk.set_context("vision_pipeline", {**log_ctx, "stage": stage})
        sentry_sdk.capture_exception(exc)
        return RuntimeError(f"stage_{stage}_failed")

    # Stage 1
    logger.info("vision.stage.load_images.start", extra=log_ctx)
    try:
        images = _load_images(photo_urls)
    except Exception as exc:
        raise _fail("1", exc) from exc

    all_norm_centroids: list[tuple[float, float]] = []
    wall_bbox: dict[str, int] | None = None

    for img in images:
        img_h, img_w = img.shape[:2]

        # Stage 2
        try:
            colour_mask = _build_colour_mask(img, colour)
        except Exception as exc:
            raise _fail("2", exc) from exc

        # Stage 3
        try:
            px_centroids = _segment_holds(img, colour_mask, sam_model)
        except Exception as exc:
            raise _fail("3", exc) from exc

        # Stage 4 (use first image's bbox as representative)
        if wall_bbox is None:
            try:
                wall_bbox = _detect_wall_bbox(img)
            except Exception as exc:
                raise _fail("4", exc) from exc

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

    # Stage 6: depth estimation + 3D model generation (non-fatal)
    model_glb_base64: str | None = None
    try:
        depth_map = _run_midas_depth(images[0], midas_model, midas_transform)
        logger.info("vision.stage.depth.complete", extra=log_ctx)

        glb_bytes = _generate_glb_model(
            image=images[0],
            depth_map=depth_map,
            hold_centroids=deduped,
            wall_bbox=wall_bbox,
            hold_colour_hex=colour,
        )
        model_glb_base64 = base64.b64encode(glb_bytes).decode("ascii")
        logger.info(
            "vision.stage.glb.generated",
            extra={**log_ctx, "glb_size_kb": len(glb_bytes) // 1024},
        )
    except Exception as exc:
        # Non-fatal: surface to Sentry with stage context but continue the pipeline.
        sentry_sdk.set_context("vision_pipeline", {**log_ctx, "stage": "6"})
        sentry_sdk.capture_exception(exc)
        logger.exception("vision.stage.glb.failed", extra=log_ctx)

    logger.info("vision.pipeline.done", extra={**log_ctx, "hold_count": hold_count})
    return {
        "hold_vector": hold_vector,
        "hold_count": hold_count,
        "wall_bbox": wall_bbox_norm,
        "debug_image_url": None,  # TODO: annotated overlay stored in S3
        "model_glb_base64": model_glb_base64,
    }
