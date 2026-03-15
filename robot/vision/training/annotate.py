"""
Semi-automatic bounding box annotation tool.

Uses a pre-trained YOLOv8 (COCO) model to detect vehicles in source images,
then presents each detection for review. The user can:
  - Press 'y' to accept the detection as-is
  - Press 'n' to skip/reject
  - Press 'd' to draw a manual box (click two corners)
  - Press 'a' to accept ALL remaining auto-detections for this image
  - Press 'q' to quit and save progress

After review, exports YOLO-format .txt labels alongside each source image.

Usage:
  python3 annotate.py                  # Run annotation UI
  python3 annotate.py --headless       # Accept all auto-detections (no UI)
  python3 annotate.py --reset          # Clear all annotations and restart
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import List, Tuple, Optional

import cv2
import numpy as np

SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / "images"
LABELS_DIR = SCRIPT_DIR / "labels"

# COCO class IDs that could be tanks/military vehicles
# 2=car, 5=bus, 7=truck — tanks often get detected as one of these
VEHICLE_CLASSES = {2, 5, 7}


def get_classes() -> List[str]:
    """Discover class names from subdirectories."""
    return sorted([
        d.name for d in IMAGES_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ])


def get_image_files(class_name: str) -> List[Path]:
    """Get all image files for a class."""
    class_dir = IMAGES_DIR / class_name
    exts = ("*.jpg", "*.jpeg", "*.png", "*.webp")
    files = []
    for ext in exts:
        files.extend(class_dir.glob(ext))
    return sorted(files)


def label_path_for(img_path: Path) -> Path:
    """Get the label file path for an image."""
    class_name = img_path.parent.name
    label_dir = LABELS_DIR / class_name
    label_dir.mkdir(parents=True, exist_ok=True)
    return label_dir / f"{img_path.stem}.txt"


def auto_detect(model, img_path: Path, conf: float = 0.15) -> List[Tuple[float, float, float, float, float, str]]:
    """Run COCO YOLO on image, return vehicle detections as (x1,y1,x2,y2,conf,class_name)."""
    results = model.predict(str(img_path), conf=conf, verbose=False)
    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            if cls_id in VEHICLE_CLASSES:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                c = float(box.conf[0])
                name = r.names[cls_id]
                detections.append((float(x1), float(y1), float(x2), float(y2), c, name))
    return detections


def xyxy_to_yolo(x1: float, y1: float, x2: float, y2: float, img_w: int, img_h: int) -> Tuple[float, float, float, float]:
    """Convert (x1,y1,x2,y2) pixel coords to YOLO (cx,cy,w,h) normalized."""
    cx = (x1 + x2) / 2.0 / img_w
    cy = (y1 + y2) / 2.0 / img_h
    w = (x2 - x1) / img_w
    h = (y2 - y1) / img_h
    return (cx, cy, w, h)


def draw_box_on_image(img: np.ndarray, x1: int, y1: int, x2: int, y2: int,
                      label: str, color: Tuple[int, int, int] = (0, 255, 0)) -> np.ndarray:
    """Draw a labeled bounding box on an image copy."""
    vis = img.copy()
    cv2.rectangle(vis, (x1, y1), (x2, y2), color, 2)
    text = f"{label}"
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
    cv2.rectangle(vis, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
    cv2.putText(vis, text, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    return vis


class ManualBoxDrawer:
    """Interactive box drawing via mouse clicks."""

    def __init__(self):
        self.points: List[Tuple[int, int]] = []
        self.done = False
        self.img: Optional[np.ndarray] = None

    def reset(self, img: np.ndarray):
        self.points = []
        self.done = False
        self.img = img.copy()

    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.points.append((x, y))
            if len(self.points) == 1:
                # Draw first point
                vis = self.img.copy()
                cv2.circle(vis, (x, y), 5, (0, 0, 255), -1)
                cv2.putText(vis, "Click opposite corner", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.imshow("Annotate", vis)
            elif len(self.points) >= 2:
                self.done = True


def annotate_interactive(classes: List[str]):
    """Run the interactive annotation UI."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("Error: ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    print("Loading COCO YOLO model for auto-detection...")
    model = YOLO("yolov8n.pt")

    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    drawer = ManualBoxDrawer()

    stats = {"accepted": 0, "rejected": 0, "manual": 0, "skipped": 0}
    quit_early = False

    for class_idx, class_name in enumerate(classes):
        if quit_early:
            break

        images = get_image_files(class_name)
        print(f"\n--- Class: {class_name} ({len(images)} images) ---")

        for img_idx, img_path in enumerate(images):
            if quit_early:
                break

            # Skip if already annotated
            lbl_path = label_path_for(img_path)
            if lbl_path.exists():
                print(f"  [{img_idx+1}/{len(images)}] {img_path.name} — already annotated, skipping")
                stats["skipped"] += 1
                continue

            img = cv2.imread(str(img_path))
            if img is None:
                print(f"  Warning: Could not read {img_path}")
                continue

            h, w = img.shape[:2]
            detections = auto_detect(model, img_path)
            print(f"  [{img_idx+1}/{len(images)}] {img_path.name} — {len(detections)} auto-detections")

            accepted_boxes: List[Tuple[float, float, float, float]] = []  # YOLO format
            accept_all = False

            # Review each auto-detection
            for det_idx, (x1, y1, x2, y2, conf, det_name) in enumerate(detections):
                ix1, iy1, ix2, iy2 = int(x1), int(y1), int(x2), int(y2)

                if accept_all:
                    yolo_box = xyxy_to_yolo(x1, y1, x2, y2, w, h)
                    accepted_boxes.append(yolo_box)
                    stats["accepted"] += 1
                    continue

                label = f"{det_name} {conf:.0%} -> {class_name}?"
                vis = draw_box_on_image(img, ix1, iy1, ix2, iy2, label, (0, 255, 0))

                # Draw instructions
                cv2.putText(vis, f"[{det_idx+1}/{len(detections)}] y=accept n=reject d=draw a=accept-all q=quit",
                            (10, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

                cv2.imshow("Annotate", vis)
                key = cv2.waitKey(0) & 0xFF

                if key == ord('y'):
                    yolo_box = xyxy_to_yolo(x1, y1, x2, y2, w, h)
                    accepted_boxes.append(yolo_box)
                    stats["accepted"] += 1
                    print(f"    Detection {det_idx+1}: ACCEPTED")

                elif key == ord('n'):
                    stats["rejected"] += 1
                    print(f"    Detection {det_idx+1}: REJECTED")

                elif key == ord('a'):
                    # Accept this and all remaining
                    yolo_box = xyxy_to_yolo(x1, y1, x2, y2, w, h)
                    accepted_boxes.append(yolo_box)
                    stats["accepted"] += 1
                    accept_all = True
                    print(f"    Detection {det_idx+1}: ACCEPTED (+ all remaining)")

                elif key == ord('q'):
                    quit_early = True
                    break

                elif key == ord('d'):
                    stats["rejected"] += 1
                    # Fall through to manual draw below

            # If no detections or user wants to draw manually
            if not quit_early:
                # Show image for manual drawing
                while True:
                    vis = img.copy()
                    # Draw already accepted boxes
                    for yb in accepted_boxes:
                        cx, cy, bw, bh = yb
                        bx1 = int((cx - bw/2) * w)
                        by1 = int((cy - bh/2) * h)
                        bx2 = int((cx + bw/2) * w)
                        by2 = int((cy + bh/2) * h)
                        cv2.rectangle(vis, (bx1, by1), (bx2, by2), (0, 255, 0), 2)

                    info = f"{len(accepted_boxes)} boxes | d=draw s=save(next) q=quit"
                    cv2.putText(vis, info, (10, h - 15),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                    cv2.imshow("Annotate", vis)
                    key = cv2.waitKey(0) & 0xFF

                    if key == ord('d'):
                        # Manual draw mode
                        draw_vis = img.copy()
                        for yb in accepted_boxes:
                            cx, cy, bw, bh = yb
                            bx1 = int((cx - bw/2) * w)
                            by1 = int((cy - bh/2) * h)
                            bx2 = int((cx + bw/2) * w)
                            by2 = int((cy + bh/2) * h)
                            cv2.rectangle(draw_vis, (bx1, by1), (bx2, by2), (0, 255, 0), 2)

                        cv2.putText(draw_vis, "Click top-left corner of tank",
                                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

                        drawer.reset(draw_vis)
                        cv2.setMouseCallback("Annotate", drawer.mouse_callback)
                        cv2.imshow("Annotate", draw_vis)

                        while not drawer.done:
                            cv2.waitKey(50)

                        cv2.setMouseCallback("Annotate", lambda *a: None)

                        if len(drawer.points) >= 2:
                            p1, p2 = drawer.points[0], drawer.points[1]
                            mx1 = min(p1[0], p2[0])
                            my1 = min(p1[1], p2[1])
                            mx2 = max(p1[0], p2[0])
                            my2 = max(p1[1], p2[1])
                            yolo_box = xyxy_to_yolo(mx1, my1, mx2, my2, w, h)
                            accepted_boxes.append(yolo_box)
                            stats["manual"] += 1
                            print(f"    Manual box added: ({mx1},{my1})-({mx2},{my2})")

                    elif key == ord('s') or key == 13:  # 's' or Enter
                        break

                    elif key == ord('q'):
                        quit_early = True
                        break

            # Save labels
            if accepted_boxes:
                with open(lbl_path, "w") as f:
                    for yb in accepted_boxes:
                        f.write(f"{class_idx} {yb[0]:.6f} {yb[1]:.6f} {yb[2]:.6f} {yb[3]:.6f}\n")
                print(f"    Saved {len(accepted_boxes)} boxes -> {lbl_path}")
            elif not quit_early:
                # Write empty label (no objects in this image)
                with open(lbl_path, "w") as f:
                    pass
                print(f"    No boxes — saved empty label")

    cv2.destroyAllWindows()

    print(f"\n=== Annotation Complete ===")
    print(f"  Accepted auto-detections: {stats['accepted']}")
    print(f"  Rejected auto-detections: {stats['rejected']}")
    print(f"  Manual boxes drawn: {stats['manual']}")
    print(f"  Previously annotated (skipped): {stats['skipped']}")
    print(f"\nLabels saved to: {LABELS_DIR}/")
    print(f"Now update train.py to use these labels, then run: python3 train.py --augment --train")


def annotate_headless(classes: List[str]):
    """Auto-accept all detections without UI (for CI or headless systems)."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("Error: ultralytics not installed.")
        sys.exit(1)

    print("Loading COCO YOLO model...")
    model = YOLO("yolov8n.pt")
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    total = 0

    for class_idx, class_name in enumerate(classes):
        images = get_image_files(class_name)
        print(f"\n--- Class: {class_name} ({len(images)} images) ---")

        for img_path in images:
            img = cv2.imread(str(img_path))
            if img is None:
                continue
            h, w = img.shape[:2]
            detections = auto_detect(model, img_path)

            lbl_path = label_path_for(img_path)
            if detections:
                with open(lbl_path, "w") as f:
                    for x1, y1, x2, y2, conf, name in detections:
                        yb = xyxy_to_yolo(x1, y1, x2, y2, w, h)
                        f.write(f"{class_idx} {yb[0]:.6f} {yb[1]:.6f} {yb[2]:.6f} {yb[3]:.6f}\n")
                total += len(detections)
                print(f"  {img_path.name}: {len(detections)} detections")
            else:
                # No detections — fall back to full-image box
                with open(lbl_path, "w") as f:
                    f.write(f"{class_idx} 0.5 0.5 0.9 0.9\n")
                total += 1
                print(f"  {img_path.name}: no auto-detect, using full-image fallback")

    print(f"\n=== Done: {total} total boxes across all images ===")
    print(f"Labels saved to: {LABELS_DIR}/")


def main():
    parser = argparse.ArgumentParser(description="Semi-automatic bounding box annotation")
    parser.add_argument("--headless", action="store_true", help="Auto-accept all detections (no UI)")
    parser.add_argument("--reset", action="store_true", help="Clear all annotations and restart")
    args = parser.parse_args()

    classes = get_classes()
    if not classes:
        print(f"No class directories found in {IMAGES_DIR}/")
        sys.exit(1)
    print(f"Classes: {classes}")

    if args.reset:
        import shutil
        if LABELS_DIR.exists():
            shutil.rmtree(LABELS_DIR)
            print(f"Cleared {LABELS_DIR}")
        return

    if args.headless:
        annotate_headless(classes)
    else:
        annotate_interactive(classes)


if __name__ == "__main__":
    main()
