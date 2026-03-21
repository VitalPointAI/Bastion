#!/usr/bin/env python3
"""
Quick visual detection test — shows camera feed with YOLO bounding boxes.

Run on the Orin Nano:
  python3 robot/vision/test_detect.py

Press 'q' to quit. Detections are printed to console with class name
and confidence. If nothing is detected, try:
  - THRESHOLD=0.1 python3 robot/vision/test_detect.py   (lower confidence)
  - IMGSZ=320 python3 robot/vision/test_detect.py       (match training size)
  - MODEL=path/to/best.engine python3 robot/vision/test_detect.py
"""
import os
import sys
import cv2

# Load .env from robot directory
_env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _v = _line.split('=', 1)
                os.environ.setdefault(_k.strip(), _v.strip())

# Configuration from env or defaults
MODEL = os.environ.get("MODEL", os.environ.get("VISION_MODEL", "best.engine"))
THRESHOLD = float(os.environ.get("THRESHOLD", os.environ.get("VISION_THRESHOLD", "0.3")))
IMGSZ = int(os.environ.get("IMGSZ", os.environ.get("VISION_IMGSZ", "320")))
CAMERA = int(os.environ.get("CAMERA", os.environ.get("CAMERA_SENSOR_ID", "0")))

print(f"Model: {MODEL}")
print(f"Threshold: {THRESHOLD}")
print(f"Inference size: {IMGSZ}")
print(f"Camera: {CAMERA}")
print("Press 'q' to quit")
print("-" * 40)

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)

# Load model
model = YOLO(MODEL)
print(f"Model loaded. Classes: {model.names}")

# Open camera via jetson_utils (works with Jetson CSI cameras)
try:
    import jetson_utils
    import numpy as np
    cam = jetson_utils.videoSource(f'csi://{CAMERA}', argv=['--input-flip=rotate-180'])
    use_jetson = True
    print("Using jetson_utils CSI camera")
except (ImportError, Exception):
    use_jetson = False
    cap = cv2.VideoCapture(CAMERA)
    if not cap.isOpened():
        print(f"ERROR: Cannot open camera {CAMERA}")
        sys.exit(1)
    print("Using V4L2 camera")

frame_count = 0
while True:
    try:
        if use_jetson:
            cuda_img = cam.Capture()
            if cuda_img is None:
                print("Failed to grab frame")
                break
            # Convert CUDA image to numpy array for OpenCV/YOLO
            frame = jetson_utils.cudaToNumpy(cuda_img)
            # jetson_utils returns RGB, YOLO expects BGR
            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            # Flip 180 degrees (camera is mounted upside down)
            frame = cv2.flip(frame, -1)
        else:
            ret, frame = cap.read()
            if not ret:
                print("Failed to grab frame")
                break
    except Exception as e:
        print(f"Camera error: {e}")
        break

    frame_count += 1

    # Run inference
    results = model(frame, conf=THRESHOLD, imgsz=IMGSZ, verbose=False)

    # Draw bounding boxes
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            cls_name = model.names.get(cls_id, f"class_{cls_id}")

            # Draw box
            color = (0, 255, 0) if conf > 0.5 else (0, 255, 255)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Draw label
            label = f"{cls_name} {conf:.0%}"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(frame, (x1, y1 - label_size[1] - 8), (x1 + label_size[0], y1), color, -1)
            cv2.putText(frame, label, (x1, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

            print(f"  [{frame_count}] {cls_name}: {conf:.1%} at ({x1},{y1})-({x2},{y2})")

    # Show frame
    cv2.imshow("BASTION Vision Test", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

if use_jetson:
    cam.Close()
else:
    cap.release()
cv2.destroyAllWindows()
print("Done")
