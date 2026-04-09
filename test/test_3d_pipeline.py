"""
Test script for the 3D holographic climbing model pipeline.

Loads real climbing images, runs MiDaS depth estimation,
generates a GLB model, and validates the output.
"""
import os
import sys
import time

# Add vision dir to path so we can import the worker
VISION_DIR = os.path.join(os.path.dirname(__file__), "..", "vision")
sys.path.insert(0, VISION_DIR)

import cv2
import numpy as np

TEST_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_1 = os.path.join(TEST_DIR, "climbing1.PNG")
IMAGE_2 = os.path.join(TEST_DIR, "climbing2.PNG")
OUTPUT_GLB = os.path.join(TEST_DIR, "output_model.glb")
OUTPUT_DEPTH = os.path.join(TEST_DIR, "output_depth.png")

HOLD_COLOUR_HEX = "#FF69B4"  # pink
FAKE_HOLD_CENTROIDS = [
    (0.3, 0.4),
    (0.5, 0.6),
    (0.7, 0.8),
    (0.2, 0.7),
    (0.6, 0.3),
]


def load_image(path: str) -> np.ndarray:
    """Load an image from disk and return as RGB numpy array."""
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not load image: {path}")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Resize so longest side <= 1080px (same as pipeline)
    h, w = img.shape[:2]
    if max(h, w) > 1080:
        scale = 1080.0 / max(h, w)
        img = cv2.resize(
            img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
        )
    return img


def make_wall_bbox(image: np.ndarray) -> dict[str, int]:
    """Create a wall bbox with 10% margin on each side."""
    h, w = image.shape[:2]
    margin_x = int(w * 0.1)
    margin_y = int(h * 0.1)
    return {
        "x": margin_x,
        "y": margin_y,
        "w": w - 2 * margin_x,
        "h": h - 2 * margin_y,
    }


def main() -> None:
    from workers.vision_worker import (
        _generate_glb_model,
        _hex_to_rgb_floats,
        _run_midas_depth,
        load_midas_model,
    )

    # ── Load images ──────────────────────────────────────────────────
    print("=" * 60)
    print("STEP 1: Loading test images")
    print("=" * 60)
    img1 = load_image(IMAGE_1)
    img2 = load_image(IMAGE_2)
    print(f"  Image 1: {img1.shape} ({IMAGE_1})")
    print(f"  Image 2: {img2.shape} ({IMAGE_2})")

    # ── Load MiDaS model ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("STEP 2: Loading MiDaS model")
    print("=" * 60)
    t0 = time.time()
    midas_model, midas_transform = load_midas_model()
    print(f"  MiDaS loaded in {time.time() - t0:.1f}s")

    # ── Run depth estimation on both images ─────────────────────────
    print("\n" + "=" * 60)
    print("STEP 3: Running MiDaS depth estimation")
    print("=" * 60)
    for i, (img, name) in enumerate([(img1, "climbing1"), (img2, "climbing2")]):
        t0 = time.time()
        depth_map = _run_midas_depth(img, midas_model, midas_transform)
        elapsed = time.time() - t0
        print(f"  {name}: depth shape={depth_map.shape}, "
              f"range=[{depth_map.min():.3f}, {depth_map.max():.3f}], "
              f"time={elapsed:.2f}s")

    # Save depth visualization for image 1
    depth_map_1 = _run_midas_depth(img1, midas_model, midas_transform)
    depth_vis = (depth_map_1 * 255).astype(np.uint8)
    depth_vis_color = cv2.applyColorMap(depth_vis, cv2.COLORMAP_INFERNO)
    cv2.imwrite(OUTPUT_DEPTH, depth_vis_color)
    print(f"  Depth map saved to: {OUTPUT_DEPTH}")
    print(f"  Depth PNG size: {os.path.getsize(OUTPUT_DEPTH) / 1024:.1f} KB")

    # ── Test _hex_to_rgb_floats ─────────────────────────────────────
    print("\n" + "=" * 60)
    print("STEP 4: Testing _hex_to_rgb_floats")
    print("=" * 60)
    rgb = _hex_to_rgb_floats(HOLD_COLOUR_HEX)
    print(f"  {HOLD_COLOUR_HEX} -> RGB floats: ({rgb[0]:.3f}, {rgb[1]:.3f}, {rgb[2]:.3f})")
    assert all(0.0 <= c <= 1.0 for c in rgb), "RGB values out of [0,1] range!"
    print("  PASS")

    # ── Generate GLB model ──────────────────────────────────────────
    print("\n" + "=" * 60)
    print("STEP 5: Generating GLB 3D model")
    print("=" * 60)
    wall_bbox = make_wall_bbox(img1)
    print(f"  Wall bbox: {wall_bbox}")
    print(f"  Hold centroids: {FAKE_HOLD_CENTROIDS}")

    t0 = time.time()
    glb_bytes = _generate_glb_model(
        image=img1,
        depth_map=depth_map_1,
        hold_centroids=FAKE_HOLD_CENTROIDS,
        wall_bbox=wall_bbox,
        hold_colour_hex=HOLD_COLOUR_HEX,
    )
    elapsed = time.time() - t0
    print(f"  GLB generation time: {elapsed:.2f}s")
    print(f"  GLB binary size: {len(glb_bytes) / 1024:.1f} KB")

    # Save GLB
    with open(OUTPUT_GLB, "wb") as f:
        f.write(glb_bytes)
    print(f"  GLB saved to: {OUTPUT_GLB}")
    print(f"  GLB file size: {os.path.getsize(OUTPUT_GLB) / 1024:.1f} KB")

    # ── Validate GLB ────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("STEP 6: Validating GLB model")
    print("=" * 60)
    import trimesh

    scene = trimesh.load(OUTPUT_GLB, file_type="glb")
    if isinstance(scene, trimesh.Scene):
        print(f"  Scene type: trimesh.Scene")
        print(f"  Geometry count: {len(scene.geometry)}")
        for name, geom in scene.geometry.items():
            v_count = len(geom.vertices) if hasattr(geom, "vertices") else "N/A"
            f_count = len(geom.faces) if hasattr(geom, "faces") else "N/A"
            has_visual = hasattr(geom, "visual") and geom.visual is not None
            visual_kind = type(geom.visual).__name__ if has_visual else "None"
            print(f"    {name}: vertices={v_count}, faces={f_count}, visual={visual_kind}")

            # Check for embedded texture on wall mesh
            if "wall" in name.lower() and has_visual:
                vis = geom.visual
                if hasattr(vis, "material") and vis.material is not None:
                    mat = vis.material
                    has_texture = (
                        hasattr(mat, "baseColorTexture")
                        and mat.baseColorTexture is not None
                    )
                    print(f"    -> Material: {type(mat).__name__}, texture embedded: {has_texture}")
    elif isinstance(scene, trimesh.Trimesh):
        print(f"  Loaded as single Trimesh (not a scene)")
        print(f"  Vertices: {len(scene.vertices)}, Faces: {len(scene.faces)}")
    else:
        print(f"  Unknown type: {type(scene)}")

    # ── Summary ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Pipeline: SUCCESS")
    print(f"  GLB file: {OUTPUT_GLB} ({os.path.getsize(OUTPUT_GLB) / 1024:.1f} KB)")
    print(f"  Depth map: {OUTPUT_DEPTH} ({os.path.getsize(OUTPUT_DEPTH) / 1024:.1f} KB)")
    print(f"  GLB is valid: YES")


if __name__ == "__main__":
    main()
