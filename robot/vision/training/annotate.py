"""
Semi-automatic bounding box annotation tool.

Uses a pre-trained YOLOv8 (COCO) model to detect vehicles in source images,
then presents each detection for review via a local web UI.

Keybindings (in browser):
  y = accept detection    n = reject detection
  d = draw manual box     a = accept all remaining auto-detections
  s = save & next image   q = quit and save progress

Usage:
  python3 annotate.py                  # Run annotation web UI
  python3 annotate.py --headless       # Accept all auto-detections (no UI)
  python3 annotate.py --reset          # Clear all annotations and restart
  python3 annotate.py --port 9090      # Use a different port
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import List, Tuple
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / "images"
LABELS_DIR = SCRIPT_DIR / "labels"

VEHICLE_CLASSES = {2, 5, 7}


def get_classes() -> List[str]:
    return sorted([
        d.name for d in IMAGES_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ])


def get_image_files(class_name: str) -> List[Path]:
    class_dir = IMAGES_DIR / class_name
    exts = ("*.jpg", "*.jpeg", "*.png", "*.webp")
    files = []
    for ext in exts:
        files.extend(class_dir.glob(ext))
    return sorted(files)


def label_path_for(img_path: Path) -> Path:
    class_name = img_path.parent.name
    label_dir = LABELS_DIR / class_name
    label_dir.mkdir(parents=True, exist_ok=True)
    return label_dir / f"{img_path.stem}.txt"


def auto_detect(model, img_path: Path, conf: float = 0.15) -> List[Tuple[float, float, float, float, float, str]]:
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
    cx = (x1 + x2) / 2.0 / img_w
    cy = (y1 + y2) / 2.0 / img_h
    w = (x2 - x1) / img_w
    h = (y2 - y1) / img_h
    return (cx, cy, w, h)


def img_to_data_uri(img_path: Path, max_w: int = 1200, max_h: int = 800) -> Tuple[str, int, int]:
    """Load image, resize for display, return as data URI + original dimensions."""
    img = Image.open(img_path)
    orig_w, orig_h = img.size
    scale = min(max_w / orig_w, max_h / orig_h, 1.0)
    if scale < 1.0:
        img = img.resize((int(orig_w * scale), int(orig_h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}", orig_w, orig_h


# ── Web UI ──────────────────────────────────────────────────────────────────

HTML_PAGE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Annotate</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a1a; color: #eee; font-family: monospace; display: flex; flex-direction: column; height: 100vh; }
  #header { background: #222; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; }
  #header .info { font-size: 14px; }
  #header .keys { font-size: 12px; color: #aaa; }
  #container { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; }
  #container img { max-width: 100%; max-height: 100%; }
  #canvas-overlay { position: absolute; top: 0; left: 0; cursor: crosshair; }
  #status { background: #333; padding: 6px 16px; font-size: 13px; }
  .box { position: absolute; border: 3px solid #0f0; }
  .box-label { position: absolute; top: -22px; left: 0; background: #0f0; color: #000; font-size: 12px; padding: 1px 4px; white-space: nowrap; }
  .box.pending { border-color: #ff0; }
  .box.pending .box-label { background: #ff0; }
  .btn { display: inline-block; padding: 4px 12px; margin: 0 4px; background: #444; color: #fff; border: 1px solid #666; cursor: pointer; font-family: monospace; font-size: 13px; }
  .btn:hover { background: #555; }
  .btn.active { background: #080; border-color: #0f0; }
  #done-screen { display: none; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
  #done-screen h1 { margin-bottom: 20px; }
</style>
</head>
<body>

<div id="header">
  <div class="info" id="img-info">Loading...</div>
  <div class="keys">
    <span class="btn" onclick="doAction('y')">Y accept</span>
    <span class="btn" onclick="doAction('n')">N reject</span>
    <span class="btn" onclick="doAction('a')">A accept-all</span>
    <span class="btn" onclick="nav(-1)">&larr; Prev</span>
    <span class="btn" onclick="doAction('s')">S save/next &rarr;</span>
    <span class="btn" onclick="doAction('z')">Z undo</span>
    <span class="btn" onclick="doAction('q')">Q quit</span>
  </div>
</div>

<div id="container">
  <img id="main-img" src="">
  <canvas id="canvas-overlay"></canvas>
</div>

<div id="status">Ready</div>

<div id="done-screen">
  <h1>Annotation Complete</h1>
  <pre id="done-stats"></pre>
</div>

<script>
let state = null;
let acceptedBoxes = [];   // [{x1,y1,x2,y2}] in original image coords
let imgEl = document.getElementById('main-img');
let canvasEl = document.getElementById('canvas-overlay');
let ctx = canvasEl.getContext('2d');

// Drag state
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let dragCurX = 0, dragCurY = 0;

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

async function loadState() {
  let resp = await fetch('/api/state');
  state = await resp.json();
  if (state.done) {
    document.getElementById('header').style.display = 'none';
    document.getElementById('container').style.display = 'none';
    document.getElementById('status').style.display = 'none';
    document.getElementById('done-screen').style.display = 'flex';
    document.getElementById('done-stats').textContent = state.stats;
    return;
  }
  acceptedBoxes = state.existing_boxes || [];
  imgEl.src = state.data_uri;
  imgEl.onload = () => {
    resizeCanvas();
    renderBoxes();
  };
  updateInfo();
}

function updateInfo() {
  if (!state) return;
  let det = state.detections || [];
  let detIdx = state.det_review_idx || 0;
  let phase = state.phase;
  let txt = state.class_name + ' | ' + state.img_name + ' (' + state.img_num + '/' + state.img_total + ')';
  if (phase === 'review' && det.length > 0) {
    txt += ' | Detection ' + (detIdx + 1) + '/' + det.length + ' | y=accept n=reject a=accept-all';
  } else if (phase === 'manual') {
    txt += ' | ' + acceptedBoxes.length + ' boxes | Drag to draw | s=save/next z=undo q=quit';
  }
  document.getElementById('img-info').textContent = txt;
}

function resizeCanvas() {
  let rect = imgEl.getBoundingClientRect();
  canvasEl.style.left = rect.left + 'px';
  canvasEl.style.top = rect.top + 'px';
  canvasEl.width = rect.width;
  canvasEl.height = rect.height;
}

function imgScale() {
  if (!state) return 1;
  let rect = imgEl.getBoundingClientRect();
  return rect.width / state.orig_w;
}

function renderBoxes() {
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  let s = imgScale();

  // Draw accepted boxes in green
  for (let b of acceptedBoxes) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x1 * s, b.y1 * s, (b.x2 - b.x1) * s, (b.y2 - b.y1) * s);
  }

  // Draw current detection in yellow if in review phase
  if (state.phase === 'review' && state.detections && state.detections.length > 0) {
    let det = state.detections[state.det_review_idx || 0];
    if (det) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(det.x1 * s, det.y1 * s, (det.x2 - det.x1) * s, (det.y2 - det.y1) * s);
      ctx.fillStyle = '#ffff00';
      ctx.font = '14px monospace';
      let label = det.name + ' ' + Math.round(det.conf * 100) + '% -> ' + state.class_name + '?';
      ctx.fillText(label, det.x1 * s, det.y1 * s - 6);
    }
  }

  // Draw in-progress drag rectangle
  if (dragging) {
    let rx = Math.min(dragStartX, dragCurX);
    let ry = Math.min(dragStartY, dragCurY);
    let rw = Math.abs(dragCurX - dragStartX);
    let rh = Math.abs(dragCurY - dragStartY);
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }
}

async function doAction(key) {
  if (state.done) return;

  let body = { action: key, accepted_boxes: acceptedBoxes };
  let resp = await fetch('/api/action', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  let result = await resp.json();

  if (result.accepted_box) {
    acceptedBoxes.push(result.accepted_box);
  }
  if (result.extra_boxes) {
    for (let b of result.extra_boxes) acceptedBoxes.push(b);
  }

  if (result.next_state) {
    state = result.next_state;
    if (state.done) {
      loadState();
      return;
    }
    if (state.new_image) {
      acceptedBoxes = state.existing_boxes || [];
      imgEl.src = state.data_uri;
      imgEl.onload = () => { resizeCanvas(); renderBoxes(); };
    } else {
      renderBoxes();
    }
    updateInfo();
    setStatus(result.message || '');
  } else {
    renderBoxes();
    updateInfo();
    setStatus(result.message || '');
  }
}

async function nav(direction) {
  if (!state || state.done) return;
  let body = { direction: direction, accepted_boxes: acceptedBoxes };
  let resp = await fetch('/api/navigate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  let result = await resp.json();
  if (result.next_state) {
    state = result.next_state;
    acceptedBoxes = state.existing_boxes || [];
    imgEl.src = state.data_uri;
    imgEl.onload = () => { resizeCanvas(); renderBoxes(); };
    updateInfo();
    setStatus(result.message || '');
  }
}

// Drag-to-draw: mousedown starts, mousemove previews, mouseup commits
canvasEl.addEventListener('mousedown', function(e) {
  if (!state || state.done) return;
  if (state.phase === 'review') return;  // no drawing during detection review
  dragging = true;
  dragStartX = e.offsetX;
  dragStartY = e.offsetY;
  dragCurX = e.offsetX;
  dragCurY = e.offsetY;
});

canvasEl.addEventListener('mousemove', function(e) {
  if (!dragging) return;
  dragCurX = e.offsetX;
  dragCurY = e.offsetY;
  renderBoxes();
});

canvasEl.addEventListener('mouseup', function(e) {
  if (!dragging) return;
  dragging = false;
  let s = imgScale();
  let sx = Math.min(dragStartX, e.offsetX) / s;
  let sy = Math.min(dragStartY, e.offsetY) / s;
  let ex = Math.max(dragStartX, e.offsetX) / s;
  let ey = Math.max(dragStartY, e.offsetY) / s;

  // Ignore tiny accidental drags (< 10px in original coords)
  if ((ex - sx) < 10 || (ey - sy) < 10) {
    renderBoxes();
    return;
  }

  acceptedBoxes.push({x1: sx, y1: sy, x2: ex, y2: ey});
  renderBoxes();
  setStatus('Box added (' + acceptedBoxes.length + ' total). Drag more, or press S to save/next.');
  updateInfo();
});

canvasEl.addEventListener('mouseleave', function() {
  if (dragging) {
    dragging = false;
    renderBoxes();
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowLeft') { e.preventDefault(); nav(-1); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); nav(1); return; }
  let key = e.key.toLowerCase();
  if (key === 'z' && state && state.phase === 'manual' && acceptedBoxes.length > 0) {
    e.preventDefault();
    acceptedBoxes.pop();
    renderBoxes();
    setStatus('Undid last box (' + acceptedBoxes.length + ' remaining)');
    updateInfo();
    return;
  }
  if (['y','n','a','s','q'].includes(key)) {
    e.preventDefault();
    doAction(key);
  }
});

window.addEventListener('resize', () => { resizeCanvas(); renderBoxes(); });
loadState();
</script>
</body>
</html>"""


class AnnotationServer:
    """Manages annotation state and serves the web UI."""

    def __init__(self, classes: List[str], model):
        self.classes = classes
        self.model = model
        self.done = False

        # Build full image list: ALL images, not just unannotated
        self.all_images: List[Tuple[int, str, Path]] = []
        for class_idx, class_name in enumerate(classes):
            for img_path in get_image_files(class_name):
                self.all_images.append((class_idx, class_name, img_path))

        self.queue_idx = 0
        self.current_detections: List[dict] = []
        self.det_review_idx = 0
        self.phase = "manual"
        self.current_data_uri = ""
        self.current_orig_w = 0
        self.current_orig_h = 0

        # Start at first unannotated image, or 0 if all done
        for i, (_, _, img_path) in enumerate(self.all_images):
            if not label_path_for(img_path).exists():
                self.queue_idx = i
                break

        if self.all_images:
            self._load_current()
        else:
            self.done = True

    def _load_existing_labels(self, img_path: Path, img_w: int, img_h: int) -> List[dict]:
        """Load existing YOLO labels and convert back to pixel coords."""
        lbl_path = label_path_for(img_path)
        if not lbl_path.exists():
            return []
        boxes = []
        for line in lbl_path.read_text().strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 5:
                cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                x1 = (cx - bw / 2) * img_w
                y1 = (cy - bh / 2) * img_h
                x2 = (cx + bw / 2) * img_w
                y2 = (cy + bh / 2) * img_h
                boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
        return boxes

    def _load_current(self):
        class_idx, class_name, img_path = self.all_images[self.queue_idx]
        data_uri, orig_w, orig_h = img_to_data_uri(img_path)
        self.current_data_uri = data_uri
        self.current_orig_w = orig_w
        self.current_orig_h = orig_h

        lbl_path = label_path_for(img_path)
        has_labels = lbl_path.exists()

        # Only run auto-detect on unannotated images
        if has_labels:
            self.current_detections = []
            self.phase = "manual"
        else:
            detections = auto_detect(self.model, img_path)
            self.current_detections = [
                {"x1": d[0], "y1": d[1], "x2": d[2], "y2": d[3], "conf": d[4], "name": d[5]}
                for d in detections
            ]
            self.phase = "review" if self.current_detections else "manual"

        self.det_review_idx = 0
        status = "has labels" if has_labels else f"{len(self.current_detections)} auto-detections"
        print(f"  [{self.queue_idx + 1}/{len(self.all_images)}] {img_path.name} — {status}")

    def get_state(self) -> dict:
        if self.done:
            return {"done": True, "stats": "Annotation complete. You can close this tab."}

        class_idx, class_name, img_path = self.all_images[self.queue_idx]
        existing = self._load_existing_labels(img_path, self.current_orig_w, self.current_orig_h)

        return {
            "done": False,
            "class_name": class_name,
            "class_idx": class_idx,
            "img_name": img_path.name,
            "img_num": self.queue_idx + 1,
            "img_total": len(self.all_images),
            "data_uri": self.current_data_uri,
            "orig_w": self.current_orig_w,
            "orig_h": self.current_orig_h,
            "detections": self.current_detections,
            "det_review_idx": self.det_review_idx,
            "phase": self.phase,
            "existing_boxes": existing,
            "new_image": True,
        }

    def handle_navigate(self, direction: int, accepted_boxes: List[dict]) -> dict:
        """Navigate to prev/next image, saving current boxes first."""
        class_idx, class_name, img_path = self.all_images[self.queue_idx]
        img = cv2.imread(str(img_path))
        h, w = img.shape[:2]
        self._save_labels(class_idx, accepted_boxes, w, h, img_path)

        new_idx = self.queue_idx + direction
        if new_idx < 0:
            new_idx = 0
        elif new_idx >= len(self.all_images):
            new_idx = len(self.all_images) - 1

        self.queue_idx = new_idx
        self._load_current()
        return {"message": "Navigated", "next_state": self.get_state()}

    def handle_action(self, action: str, accepted_boxes: List[dict]) -> dict:
        if self.done:
            return {"message": "Done", "next_state": self.get_state()}

        class_idx, class_name, img_path = self.all_images[self.queue_idx]
        img = cv2.imread(str(img_path))
        h, w = img.shape[:2]

        if action == 'q':
            self._save_labels(class_idx, accepted_boxes, w, h, img_path)
            self.done = True
            return {"message": "Quitting...", "next_state": self.get_state()}

        if self.phase == "review" and self.current_detections:
            det = self.current_detections[self.det_review_idx]

            if action == 'y':
                box = {"x1": det["x1"], "y1": det["y1"], "x2": det["x2"], "y2": det["y2"]}
                self.det_review_idx += 1
                if self.det_review_idx >= len(self.current_detections):
                    self.phase = "manual"
                st = self.get_state()
                st["new_image"] = False
                st["det_review_idx"] = self.det_review_idx
                st["phase"] = self.phase
                return {"message": "Accepted", "accepted_box": box, "next_state": st}

            elif action == 'n':
                self.det_review_idx += 1
                if self.det_review_idx >= len(self.current_detections):
                    self.phase = "manual"
                st = self.get_state()
                st["new_image"] = False
                st["det_review_idx"] = self.det_review_idx
                st["phase"] = self.phase
                return {"message": "Rejected", "next_state": st}

            elif action == 'a':
                box = {"x1": det["x1"], "y1": det["y1"], "x2": det["x2"], "y2": det["y2"]}
                extra_boxes = []
                for i in range(self.det_review_idx + 1, len(self.current_detections)):
                    d = self.current_detections[i]
                    extra_boxes.append({"x1": d["x1"], "y1": d["y1"], "x2": d["x2"], "y2": d["y2"]})
                self.phase = "manual"
                st = self.get_state()
                st["new_image"] = False
                st["phase"] = self.phase
                return {"message": f"Accepted all", "accepted_box": box,
                        "extra_boxes": extra_boxes, "next_state": st}

        # Manual phase actions
        if action == 's':
            self._save_labels(class_idx, accepted_boxes, w, h, img_path)
            # Advance to next image
            if self.queue_idx + 1 < len(self.all_images):
                self.queue_idx += 1
                self._load_current()
                return {"message": "Saved, loading next...", "next_state": self.get_state()}
            else:
                return {"message": "Saved. Last image.", "next_state": self.get_state()}

        return {"message": f"Drag to draw boxes, S=save/next, arrow keys to navigate"}

    def _save_labels(self, class_idx: int, accepted_boxes: List[dict], w: int, h: int, img_path: Path):
        lbl_path = label_path_for(img_path)
        if accepted_boxes:
            with open(lbl_path, "w") as f:
                for b in accepted_boxes:
                    yb = xyxy_to_yolo(b["x1"], b["y1"], b["x2"], b["y2"], w, h)
                    f.write(f"{class_idx} {yb[0]:.6f} {yb[1]:.6f} {yb[2]:.6f} {yb[3]:.6f}\n")
            print(f"    Saved {len(accepted_boxes)} boxes -> {lbl_path}")
        else:
            with open(lbl_path, "w") as f:
                pass
            print(f"    No boxes — saved empty label")


def make_handler(server: AnnotationServer):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass  # Suppress request logging

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == '/':
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.end_headers()
                self.wfile.write(HTML_PAGE.encode())
            elif parsed.path == '/api/state':
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(server.get_state()).encode())
            else:
                self.send_response(404)
                self.end_headers()

        def do_POST(self):
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))

            if self.path == '/api/action':
                action = body.get('action', '')
                accepted_boxes = body.get('accepted_boxes', [])
                result = server.handle_action(action, accepted_boxes)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            elif self.path == '/api/navigate':
                direction = body.get('direction', 0)
                accepted_boxes = body.get('accepted_boxes', [])
                result = server.handle_navigate(direction, accepted_boxes)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            else:
                self.send_response(404)
                self.end_headers()

    return Handler


def annotate_interactive(classes: List[str], port: int = 8787):
    """Run the web-based annotation UI."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("Error: ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    print("Loading COCO YOLO model for auto-detection...")
    model = YOLO("yolov8n.pt")
    LABELS_DIR.mkdir(parents=True, exist_ok=True)

    server = AnnotationServer(classes, model)
    if server.done:
        print("All images already annotated!")
        return

    httpd = HTTPServer(('127.0.0.1', port), make_handler(server))
    url = f"http://127.0.0.1:{port}"
    print(f"\n  Annotation UI: {url}")
    print(f"  Opening browser...\n")

    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

    httpd.server_close()

    print(f"\n=== Annotation Complete ===")
    print(f"  Accepted auto-detections: {server.stats['accepted']}")
    print(f"  Rejected auto-detections: {server.stats['rejected']}")
    print(f"  Manual boxes drawn: {server.stats['manual']}")
    print(f"  Previously annotated (skipped): {server.stats['skipped']}")
    print(f"\nLabels saved to: {LABELS_DIR}/")


def annotate_headless(classes: List[str]):
    """Auto-accept all detections without UI."""
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
    parser.add_argument("--port", type=int, default=8787, help="Port for web UI (default: 8787)")
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
        annotate_interactive(classes, port=args.port)


if __name__ == "__main__":
    main()
