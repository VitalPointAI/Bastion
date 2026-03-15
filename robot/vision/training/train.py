"""
YOLOv8 custom tank detection training pipeline.

Workflow:
  1. Place reference images in images/<class_name>/ directories
  2. Run: python train.py --augment   (generates augmented dataset)
  3. Run: python train.py --train     (fine-tunes YOLOv8n on augmented data)
  4. Run: python train.py --export    (exports to ONNX/TensorRT for Jetson)

The trained model is saved to runs/detect/bastion-tanks/weights/best.pt
Copy it to the robot and update YOLO_MODEL in .env.

Requirements:
  pip install ultralytics albumentations opencv-python-headless
"""
from __future__ import annotations

import argparse
import os
import random
import shutil
import sys
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / "images"
LABELS_DIR = SCRIPT_DIR / "labels"
AUGMENTED_DIR = SCRIPT_DIR / "augmented"
DATASET_DIR = SCRIPT_DIR / "dataset"
YAML_PATH = SCRIPT_DIR / "dataset.yaml"

# ---------------------------------------------------------------------------
# Augmentation
# ---------------------------------------------------------------------------

def augment_image(img: np.ndarray, idx: int) -> List[Tuple[np.ndarray, str]]:
    """Generate augmented variants of a single image.

    Returns list of (augmented_image, suffix) tuples.
    """
    results: List[Tuple[np.ndarray, str]] = []
    h, w = img.shape[:2]

    # Original
    results.append((img.copy(), f"orig_{idx}"))

    # Horizontal flip
    results.append((cv2.flip(img, 1), f"hflip_{idx}"))

    # Brightness variations
    for factor, name in [(0.6, "dark"), (0.8, "dim"), (1.2, "bright"), (1.5, "vbright")]:
        adjusted = np.clip(img.astype(np.float32) * factor, 0, 255).astype(np.uint8)
        results.append((adjusted, f"{name}_{idx}"))

    # Rotation variations (-15 to +15 degrees)
    for angle in [-15, -10, -5, 5, 10, 15]:
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        rotated = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        results.append((rotated, f"rot{angle}_{idx}"))

    # Scale variations (zoom in/out)
    for scale, name in [(0.7, "zoomout"), (1.3, "zoomin")]:
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(img, (new_w, new_h))
        if scale < 1.0:
            # Pad to original size
            canvas = np.zeros_like(img)
            y_off = (h - new_h) // 2
            x_off = (w - new_w) // 2
            canvas[y_off:y_off+new_h, x_off:x_off+new_w] = resized
            results.append((canvas, f"{name}_{idx}"))
        else:
            # Crop center to original size
            y_off = (new_h - h) // 2
            x_off = (new_w - w) // 2
            cropped = resized[y_off:y_off+h, x_off:x_off+w]
            results.append((cropped, f"{name}_{idx}"))

    # Gaussian noise
    noise = np.random.normal(0, 15, img.shape).astype(np.int16)
    noisy = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    results.append((noisy, f"noise_{idx}"))

    # Gaussian blur
    blurred = cv2.GaussianBlur(img, (5, 5), 0)
    results.append((blurred, f"blur_{idx}"))

    # Color jitter (HSV shift)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.int16)
    hsv[:, :, 0] = (hsv[:, :, 0] + random.randint(-10, 10)) % 180
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] + random.randint(-30, 30), 0, 255)
    jittered = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
    results.append((jittered, f"jitter_{idx}"))

    return results


def run_augmentation(classes: List[str]) -> int:
    """Augment all source images and create YOLO-format dataset.

    Each augmented image gets a full-image bounding box label (the tank
    occupies most/all of the reference image).

    Returns total number of augmented images generated.
    """
    # Clean previous
    if AUGMENTED_DIR.exists():
        shutil.rmtree(AUGMENTED_DIR)
    AUGMENTED_DIR.mkdir(parents=True)

    total = 0

    for class_idx, class_name in enumerate(classes):
        class_dir = IMAGES_DIR / class_name
        if not class_dir.exists():
            print(f"  Warning: {class_dir} not found, skipping")
            continue

        image_files = list(class_dir.glob("*.jpg")) + list(class_dir.glob("*.jpeg")) + \
                      list(class_dir.glob("*.png")) + list(class_dir.glob("*.webp"))

        if not image_files:
            print(f"  Warning: No images found in {class_dir}")
            continue

        print(f"  Class '{class_name}': {len(image_files)} source images")

        for img_idx, img_path in enumerate(image_files):
            img = cv2.imread(str(img_path))
            if img is None:
                print(f"    Warning: Could not read {img_path}")
                continue

            augmented = augment_image(img, img_idx)
            for aug_img, suffix in augmented:
                out_name = f"{class_name}_{suffix}"
                img_out = AUGMENTED_DIR / f"{out_name}.jpg"
                label_out = AUGMENTED_DIR / f"{out_name}.txt"

                cv2.imwrite(str(img_out), aug_img)

                # YOLO label: class_idx cx cy w h (normalized)
                # Full-image bbox since the reference image IS the tank
                with open(label_out, "w") as f:
                    f.write(f"{class_idx} 0.5 0.5 0.9 0.9\n")

                total += 1

    print(f"  Total augmented images: {total}")
    return total


def create_dataset_split(classes: List[str], val_ratio: float = 0.15):
    """Split augmented data into train/val and create dataset.yaml."""
    if DATASET_DIR.exists():
        shutil.rmtree(DATASET_DIR)

    train_img = DATASET_DIR / "images" / "train"
    val_img = DATASET_DIR / "images" / "val"
    train_lbl = DATASET_DIR / "labels" / "train"
    val_lbl = DATASET_DIR / "labels" / "val"

    for d in [train_img, val_img, train_lbl, val_lbl]:
        d.mkdir(parents=True)

    # Gather all augmented image+label pairs
    all_images = sorted(AUGMENTED_DIR.glob("*.jpg"))
    random.shuffle(all_images)

    split_idx = max(1, int(len(all_images) * (1 - val_ratio)))
    train_files = all_images[:split_idx]
    val_files = all_images[split_idx:]

    for files, img_dir, lbl_dir in [
        (train_files, train_img, train_lbl),
        (val_files, val_img, val_lbl),
    ]:
        for img_path in files:
            lbl_path = img_path.with_suffix(".txt")
            shutil.copy2(img_path, img_dir / img_path.name)
            if lbl_path.exists():
                shutil.copy2(lbl_path, lbl_dir / lbl_path.name)

    print(f"  Train: {len(train_files)}, Val: {len(val_files)}")

    # Create dataset.yaml
    yaml_content = f"""# Bastion custom tank detection dataset
path: {DATASET_DIR.resolve()}
train: images/train
val: images/val

nc: {len(classes)}
names: {classes}
"""
    YAML_PATH.write_text(yaml_content)
    print(f"  Dataset YAML: {YAML_PATH}")


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def run_training(epochs: int = 100, imgsz: int = 640, batch: int = 8):
    """Fine-tune YOLOv8n on the custom dataset."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("Error: ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    if not YAML_PATH.exists():
        print("Error: dataset.yaml not found. Run --augment first.")
        sys.exit(1)

    model = YOLO("yolov8n.pt")  # Start from pretrained nano model
    results = model.train(
        data=str(YAML_PATH),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        name="bastion-tanks",
        project=str(SCRIPT_DIR / "runs" / "detect"),
        patience=20,
        save=True,
        plots=True,
        device=0,  # GPU (use 'cpu' if no GPU)
    )

    best_path = SCRIPT_DIR / "runs" / "detect" / "bastion-tanks" / "weights" / "best.pt"
    if best_path.exists():
        print(f"\n  Best model: {best_path}")
        print(f"  Copy to robot and set YOLO_MODEL={best_path.name} in .env")
    else:
        print("\n  Training complete — check runs/detect/bastion-tanks/")

    return results


def run_export():
    """Export best model to ONNX and TensorRT for Jetson deployment."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("Error: ultralytics not installed.")
        sys.exit(1)

    best_path = SCRIPT_DIR / "runs" / "detect" / "bastion-tanks" / "weights" / "best.pt"
    if not best_path.exists():
        print("Error: best.pt not found. Run --train first.")
        sys.exit(1)

    model = YOLO(str(best_path))

    # Export to ONNX
    model.export(format="onnx", imgsz=640)
    print("  Exported to ONNX")

    # Try TensorRT (only on Jetson/NVIDIA)
    try:
        model.export(format="engine", imgsz=640)
        print("  Exported to TensorRT engine")
    except Exception as e:
        print(f"  TensorRT export skipped: {e}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Bastion tank detection training pipeline")
    parser.add_argument("--augment", action="store_true", help="Generate augmented dataset from source images")
    parser.add_argument("--train", action="store_true", help="Fine-tune YOLOv8n on augmented dataset")
    parser.add_argument("--export", action="store_true", help="Export trained model to ONNX/TensorRT")
    parser.add_argument("--epochs", type=int, default=100, help="Training epochs (default: 100)")
    parser.add_argument("--batch", type=int, default=8, help="Batch size (default: 8)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size (default: 640)")
    parser.add_argument("--all", action="store_true", help="Run augment + train + export")
    args = parser.parse_args()

    # Discover classes from subdirectories in images/
    classes = sorted([
        d.name for d in IMAGES_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ])

    if not classes:
        print(f"No class directories found in {IMAGES_DIR}/")
        print(f"Create subdirectories named after each tank type, e.g.:")
        print(f"  {IMAGES_DIR}/t72/")
        print(f"  {IMAGES_DIR}/ztz99/")
        print(f"Then place reference images in each directory.")
        sys.exit(1)

    print(f"Classes: {classes}")

    if args.augment or args.all:
        print("\n=== Augmentation ===")
        run_augmentation(classes)
        create_dataset_split(classes)

    if args.train or args.all:
        print("\n=== Training ===")
        run_training(epochs=args.epochs, imgsz=args.imgsz, batch=args.batch)

    if args.export or args.all:
        print("\n=== Export ===")
        run_export()

    if not (args.augment or args.train or args.export or args.all):
        parser.print_help()


if __name__ == "__main__":
    main()
