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

# Open camera
cap = cv2.VideoCapture(CAMERA)
if not cap.isOpened():
    # Try GStreamer pipeline for Jetson CSI camera
    gst = f"nvarguscamerasrc sensor-id={CAMERA} ! video/x-raw(memory:NVMM),width=640,height=480,framerate=30/1 ! nvvidconv ! video/x-raw,format=BGRx ! videoconvert ! video/x-raw,format=BGR ! appsink"
    cap = cv2.VideoCapture(gst, cv2.CAP_GSTREAMER)
    if not cap.isOpened():
        print(f"ERROR: Cannot open camera {CAMERA}")
        sys.exit(1)
    print("Using GStreamer CSI camera")
else:
    print("Using V4L2 camera")

frame_count = 0
while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
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

cap.release()
cv2.destroyAllWindows()
print("Done")
