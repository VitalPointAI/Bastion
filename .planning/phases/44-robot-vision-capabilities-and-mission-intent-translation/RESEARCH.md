# Phase 44: Robot Vision Capabilities & Mission Intent Translation - Research

**Researched:** 2026-03-13
**Domain:** Jetson Orin Nano vision stack, mission intent translation, DID-based capability registration, RVR+ control
**Confidence:** HIGH (core patterns), MEDIUM (VLM model selection on-device), HIGH (codebase integration)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- CSI camera module (Raspberry Pi Camera v2/v3 or Arducam via CSI ribbon cable)
- NVIDIA Jetson Inference library (jetson-inference) for detection/classification — TensorRT-accelerated
- Full detection stack: object detection (detectNet), specific target identification, obstacle awareness, scene description via VLM
- Custom target matching: ORB/SIFT feature matching + VLM-based matching (not hardcoded; generalized "find this uploaded picture")
- Vision data flow: structured detection JSON + key frame JPEG snapshots over existing WebSocket protocol
- Intent translation: LLM function calling (primary) + local template fallback (offline/simple patterns)
- Dual execution location: cloud backend (UI/DAO-originated) + on-robot Jetson (local/direct)
- Pre-flight validation before mission dispatch
- DID document national policy caveats enforced — coalition constraints limit mission acceptance
- DAO authorization must trace back to approved DAO decision
- Mission behavior profiles stored in Bastion (DAO-governed), referenced by name in MissionJSON
- Profile dictates: navigation approach, comms frequency, obstacle response, speed limits, vision update cadence
- Four new mission types: recon_area, visual_search, overwatch, resupply_route
- AI-planned sweep paths for recon_area and visual_search
- Lethal force ALWAYS requires direct human authorization — robot stops and awaits before engagement
- Vision-guided navigation throughout approach (not dead-reckoning with visual confirmation)

### Claude's Discretion
- Exact VLM model selection for scene description on Jetson (LLaVA, VILA, etc.)
- Feature matching algorithm details (ORB vs SIFT vs other)
- WebSocket message format for vision data (extend TelemetryMsg vs new VisionMsg)
- Local fallback NLP template design
- Sweep path planning algorithm specifics
- Key frame compression and resolution settings
- Simulate mode implementation for vision (mock detections for testing without camera)

### Deferred Ideas (OUT OF SCOPE)
- Fine-tuned YOLO training pipeline for custom target detection
- SLAM / mapping integration for true autonomous navigation
- Voice command input via microphone on Jetson (speech-to-text)
- DAO governance implementation for mission profiles (this phase assumes DAO infrastructure exists)
</user_constraints>

---

## Summary

Phase 44 adds a vision layer on top of an already well-structured robot stack. The Bastion robot codebase has solid foundations: Pydantic models with Zod mirrors, a state-machine MissionExecutor, an RVRDriver with simulate mode, WebSocket protocol with message stamping and dedup, and DID-based resource registration in the ResourceRegistry. The primary work is additive — new Python modules for vision/camera and intent translation, model extensions (new mission types, profile reference, VisionMsg), and new backend service methods (profile resolution, intent endpoint, pre-flight validator).

The Jetson Orin Nano Nano 8GB can run: TensorRT-accelerated detectNet for real-time object detection, NanoOWL for open-vocabulary detection by text prompt, NanoSAM for segmentation, and VILA-2.7B or LLaVA for scene description at reduced frame rate (~1-2 fps for VLM queries, 30+ fps for detectNet). The ORB+BFMatcher pattern from OpenCV (already available on Jetson via system opencv4) handles reference-image target matching. The `instructor` library is the standard Python pattern for LLM-to-Pydantic-model structured output.

**Primary recommendation:** Implement vision as a standalone `robot/vision/` module with a `VisionEngine` class that wraps jetson-inference and OpenCV, callable from `MissionExecutor` behavior handlers. Keep vision decode/inference off the main asyncio loop by running it in an asyncio executor thread. Use `instructor` + Claude/OpenAI API (cloud path) or template matching (offline path) for intent translation.

---

## Standard Stack

### Core (on Jetson / Python)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jetson-inference | master (git) | detectNet, imageNet, videoSource, videoOutput | NVIDIA-native TensorRT-accelerated; CSI camera first-class support |
| jetson-utils | master (git) | cudaToNumpy, videoSource, JPEG save | Companion to jetson-inference; same install |
| opencv-python | system (4.x) | ORB feature matching, BFMatcher, JPEG encode | Pre-installed on JetPack; no pip install needed |
| numpy | system (1.x) | Image array ops | Dependency of jetson-utils cudaToNumpy output |
| instructor | >=1.0 | Pydantic-typed LLM structured output for intent translation | De-facto standard; supports OpenAI, Anthropic, Ollama |
| pydantic | >=2.0 | Already in requirements.txt; model extension | Existing dependency |

### Supporting (on Jetson / Python)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| NanoOWL | github (NVIDIA-AI-IOT) | Open-vocabulary detection by text prompt | "find this class of object" missions; VLM fallback for detection |
| VILA-2.7B (via jetson-containers) | NanoLLM container | Scene description, natural language scene queries | recon_area, overwatch — scene description output |

### Core (Backend / TypeScript)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | >=3.x | Already in use; extend schemas | Existing dependency; mirrors Python Pydantic |
| openai / anthropic SDK | latest | Intent translation LLM calls | Already used in agents/ |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NanoOWL | standard detectNet with class filtering | NanoOWL works with arbitrary text prompts vs fixed 91-class SSD; better for "find this vehicle type" |
| VILA-2.7B (jetson-containers) | LLaVA via ollama | VILA is NVIDIA-native, better quantization for Orin Nano; ollama is simpler to install but slower |
| instructor library | raw LLM JSON + manual parsing | instructor handles validation, retries, schema enforcement automatically |

**Installation (robot side):**
```bash
# jetson-inference: git clone + cmake build (not pip)
git clone --recursive https://github.com/dusty-nv/jetson-inference
cd jetson-inference/build && cmake ../ && make -j$(nproc) && sudo make install

# Python packages (add to robot/requirements.txt)
pip install instructor>=1.0
# NanoOWL: git clone + pip install -e
git clone https://github.com/NVIDIA-AI-IOT/nanoowl /opt/nanoowl && pip install -e /opt/nanoowl

# VILA via jetson-containers (optional, heavyweight):
# docker pull dustynv/nano_llm:vila-r36.2.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
robot/
├── vision/
│   ├── __init__.py
│   ├── vision_engine.py     # VisionEngine: detectNet + NanoOWL + feature matching
│   ├── camera.py            # videoSource wrapper (CSI + simulate)
│   ├── feature_matcher.py   # ORB/BFMatcher target identification
│   ├── vlm_client.py        # Scene description via VILA/LLaVA (optional, heavy)
│   └── models.py            # VisionMsg, DetectionResult, VisionConfig Pydantic models
├── intent/
│   ├── __init__.py
│   ├── translator.py        # NL → MissionJSON via instructor + LLM
│   ├── fallback.py          # Template-based local fallback
│   └── decomposer.py        # Strategic objective → multiple MissionJSON commands
├── sweep/
│   ├── __init__.py
│   └── path_planner.py      # Boustrophedon/lawnmower sweep path generation
├── mission_executor.py      # Extend: add new mission type handlers
├── models.py                # Extend: new fields + VisionMsg
├── config.py                # Extend: vision/camera config vars
...
```

### Pattern 1: jetson-inference detectNet in asyncio
**What:** Run TensorRT inference in a thread pool executor so it does not block the asyncio event loop.
**When to use:** Any async method in MissionExecutor that needs detections.

```python
# Source: jetson-inference docs + asyncio.to_thread pattern
import jetson.inference
import jetson.utils
import asyncio

class VisionEngine:
    def __init__(self, model: str = "ssd-mobilenet-v2", threshold: float = 0.5):
        # Must be initialized on the calling thread; not constructed in asyncio
        self._net = jetson.inference.detectNet(model, threshold=threshold)

    def _capture_and_detect(self, camera) -> list:
        """Synchronous; called via to_thread from async context."""
        img = camera.Capture()
        if img is None:
            return []
        detections = self._net.Detect(img)
        return [
            {
                "class_desc": self._net.GetClassDesc(d.ClassID),
                "confidence": d.Confidence,
                "left": d.Left, "top": d.Top,
                "right": d.Right, "bottom": d.Bottom,
                "center_x": d.Center[0], "center_y": d.Center[1],
            }
            for d in detections
        ]

    async def detect_once(self, camera) -> list:
        return await asyncio.to_thread(self._capture_and_detect, camera)
```

### Pattern 2: CSI Camera Initialization
**What:** Open CSI camera using jetson-utils videoSource with standard Jetson URI format.
**When to use:** Hardware camera on Jetson (not simulate mode).

```python
# Source: jetson-inference aux-streaming docs
import jetson.utils

def open_camera(sensor_id: int = 0, width: int = 1280, height: int = 720, fps: int = 30):
    """Open CSI camera. Returns videoSource object."""
    # CSI URI: csi://0 opens nvarguscamerasrc (MIPI CSI-2)
    camera = jetson.utils.videoSource(f"csi://{sensor_id}")
    return camera

def capture_jpeg(img_cuda) -> bytes:
    """Convert CUDA image to JPEG bytes for WebSocket transmission."""
    import numpy as np
    import cv2
    # cudaToNumpy returns HxWxC numpy array (BGR)
    np_img = jetson.utils.cudaToNumpy(img_cuda)
    _, jpeg_buf = cv2.imencode('.jpg', np_img, [cv2.IMWRITE_JPEG_QUALITY, 60])
    return jpeg_buf.tobytes()
```

### Pattern 3: ORB Feature Matching for Reference Image
**What:** Match reference image (uploaded by user) against camera frame region.
**When to use:** visual_search mission — "find this uploaded picture."

```python
# Source: OpenCV docs + feature matching tutorial
import cv2
import numpy as np

class FeatureMatcher:
    def __init__(self, n_features: int = 500, match_threshold: float = 0.75):
        self._orb = cv2.ORB_create(nfeatures=n_features)
        # NORM_HAMMING required for binary descriptors (ORB)
        self._matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        self._match_threshold = match_threshold

    def set_reference(self, reference_image_bytes: bytes) -> bool:
        """Load reference image and extract keypoints/descriptors."""
        nparr = np.frombuffer(reference_image_bytes, np.uint8)
        ref_gray = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if ref_gray is None:
            return False
        self._kp_ref, self._desc_ref = self._orb.detectAndCompute(ref_gray, None)
        return self._desc_ref is not None and len(self._kp_ref) > 10

    def match(self, frame_gray: np.ndarray) -> dict:
        """Return match result: found bool, confidence 0-1, bounding box."""
        if self._desc_ref is None:
            return {"found": False, "confidence": 0.0}
        kp_frame, desc_frame = self._orb.detectAndCompute(frame_gray, None)
        if desc_frame is None or len(kp_frame) < 4:
            return {"found": False, "confidence": 0.0}
        # Lowe's ratio test via knnMatch
        matches = self._matcher.knnMatch(self._desc_ref, desc_frame, k=2)
        good = [m for m, n in matches if m.distance < self._match_threshold * n.distance]
        confidence = min(len(good) / max(len(self._kp_ref), 1), 1.0)
        return {"found": len(good) >= 10, "confidence": confidence, "match_count": len(good)}
```

### Pattern 4: Intent Translation via `instructor`
**What:** Use `instructor` to wrap an LLM call and return a validated Pydantic `MissionJSON`.
**When to use:** Cloud path — UI or DAO text command → structured MissionJSON.

```python
# Source: instructor docs (python.useinstructor.com)
import instructor
from openai import OpenAI
from models import MissionJSON  # Pydantic v2 model

client = instructor.from_openai(OpenAI())

SYSTEM_PROMPT = """
You are a military mission planning assistant. Convert natural language objectives into
structured MissionJSON commands for the Bastion robot system. Use ONLY supported commands:
recon_area, visual_search, overwatch, resupply_route, patrol_route, find_engage.
Each command represents a single atomic mission task. For strategic objectives, return
multiple missions in priority order.
"""

def translate_intent(text: str, robot_id: str) -> list[MissionJSON]:
    """Translate natural language to one or more MissionJSON objects."""
    missions = client.chat.completions.create(
        model="gpt-4o",
        response_model=list[MissionJSON],
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
    )
    # Set robot_id on all returned missions
    for m in missions:
        m.robot_id = robot_id
    return missions
```

### Pattern 5: Template-Based Fallback (offline)
**What:** Regex+keyword patterns for simple commands when no LLM is available.
**When to use:** Offline/degraded connectivity; simple well-known patterns.

```python
# Simple template dispatch — no external dependency
import re
from models import MissionJSON, MissionParams, MissionState
import uuid, datetime

TEMPLATES = [
    (re.compile(r"patrol|survey|sweep", re.I), "patrol_route"),
    (re.compile(r"recon|reconn|surveil", re.I), "recon_area"),
    (re.compile(r"watch|overwatch|monitor|observe", re.I), "overwatch"),
    (re.compile(r"resupply|deliver|supply", re.I), "resupply_route"),
    (re.compile(r"find|search|locate|look for", re.I), "visual_search"),
]

def template_translate(text: str, robot_id: str, issued_by: str) -> MissionJSON | None:
    for pattern, command in TEMPLATES:
        if pattern.search(text):
            return MissionJSON(
                mission_id=str(uuid.uuid4()),
                robot_id=robot_id,
                command=command,
                params=MissionParams(),
                issued_by=issued_by,
                timestamp=datetime.datetime.utcnow(),
                auth_token="",
            )
    return None
```

### Pattern 6: Boustrophedon Sweep Path
**What:** Generate a lawnmower (boustrophedon) sweep path over a rectangular area.
**When to use:** recon_area and visual_search missions — AI-planned coverage path.

```python
# Source: standard robotics pattern; no external library needed
from models import Waypoint
import math

def generate_sweep_path(
    area: dict,  # {x_min, y_min, x_max, y_max} room-space meters
    strip_width: float = 0.3,  # meters between sweep passes (robot body width)
    direction: str = "horizontal",
) -> list[Waypoint]:
    """Generate boustrophedon waypoints for complete area coverage."""
    x_min, y_min = area["x_min"], area["y_min"]
    x_max, y_max = area["x_max"], area["y_max"]
    waypoints: list[Waypoint] = []

    if direction == "horizontal":
        y = y_min
        left_to_right = True
        while y <= y_max:
            if left_to_right:
                waypoints.append(Waypoint(x=x_min, y=y))
                waypoints.append(Waypoint(x=x_max, y=y))
            else:
                waypoints.append(Waypoint(x=x_max, y=y))
                waypoints.append(Waypoint(x=x_min, y=y))
            y += strip_width
            left_to_right = not left_to_right
    return waypoints
```

### Pattern 7: VisionMsg WebSocket Type
**What:** Extend the existing protocol with a new `robot:vision` message type.
**When to use:** Any time vision detections or key frames are sent from robot to Bastion.

Recommendation: **Use a new VisionMsg type** (not extending TelemetryMsg) because vision data is asynchronous/event-driven (on detection) while telemetry is periodic heartbeats. These have different cadences and different consumers.

```python
# robot/models.py extension
class DetectionResult(BaseModel):
    class_desc: str
    confidence: float
    bbox: Dict[str, float]  # {"left", "top", "right", "bottom"}

class VisionMsg(BaseModel):
    """Vision detection event sent from robot to Bastion."""
    type: str = "robot:vision"
    robot_id: str
    mission_id: Optional[str] = None
    timestamp: datetime
    detections: List[DetectionResult] = Field(default_factory=list)
    scene_description: Optional[str] = None   # VLM output (if available)
    target_match: Optional[Dict[str, Any]] = None  # ORB match result
    keyframe_jpeg_b64: Optional[str] = None   # Base64 JPEG; None when disabled
    message_id: Optional[str] = None
```

### Anti-Patterns to Avoid
- **Running TensorRT inference on the asyncio loop thread:** jetson-inference blocks for 10-30ms per frame. Use `asyncio.to_thread()`.
- **Initializing jetson-inference inside `if simulate:` guards at import time:** The library is not available on dev machines. Guard with try/except ImportError.
- **Hard-coding vision update cadence in mission executor:** Cadence is profile-dependent. Pass it as profile config to VisionEngine.
- **Embedding profile parameters in MissionJSON params:** Profiles are DAO-governed and live in Bastion backend. MissionJSON carries only `profile_name: str` as a reference.
- **Returning raw LLM text as MissionJSON:** Always use `instructor` or a validator to ensure schema compliance before dispatch.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TensorRT model inference | Custom inference pipeline | jetson-inference detectNet | Engine caching, FP16/INT8 precision, CUDA memory management |
| Open-vocabulary detection | Class-filtering SSD | NanoOWL (OWL-ViT) | Detects arbitrary text prompts; no retraining needed |
| Scene description VLM | Fine-tuned caption model | VILA-2.7B / LLaVA (jetson-containers) | Already optimized for Jetson with AWQ quantization |
| Structured LLM output | JSON parsing + retry loops | `instructor` library | Schema enforcement, automatic retry, validation handled |
| Feature descriptor matching | Custom distance metric | OpenCV BFMatcher + ORB | NORM_HAMMING + Lowe's ratio test is battle-tested |
| Coverage path planning | Ad-hoc waypoint generation | Boustrophedon algorithm (50 lines) | Complete mathematical coverage guarantee; handles obstacles |

**Key insight:** The Jetson ecosystem (jetson-inference + jetson-containers + NanoOWL) has already solved the hardest parts of edge inference. Use these instead of writing custom CUDA pipelines.

---

## Common Pitfalls

### Pitfall 1: jetson-inference CSI Camera on Headless System
**What goes wrong:** `videoSource("csi://0")` fails with "Failed to create CaptureSession" or EGL display errors on a headless Jetson (no display connected).
**Why it happens:** nvarguscamerasrc requires the NVIDIA display stack in certain configurations; some JetPack versions have headless issues.
**How to avoid:** Set `DISPLAY=:0` or use `--headless` flag if available. Consider V4L2 adapter (`/dev/video0`) as fallback for testing. In simulate mode, skip camera entirely.
**Warning signs:** "EGL display error" or "Failed to create CaptureSession" in logs at startup.

### Pitfall 2: drive_with_heading Timeout on RVR+
**What goes wrong:** Robot stops unexpectedly mid-navigation after ~2 seconds.
**Why it happens:** RVR+ firmware has a drive command timeout — if `drive_with_heading` is not refreshed every 2 seconds, motors stop as a safety feature.
**How to avoid:** For longer drives, call `drive_with_heading` in a loop with ≤1.5s sleep intervals (existing `drive()` implementation does this via duration-based loop). For vision-guided navigation, integrate drive refresh into the detection loop.
**Warning signs:** Robot moves for exactly 2 seconds then stops even when `duration_sec` was longer.

### Pitfall 3: asyncio + Sphero SDK Mixing
**What goes wrong:** `SpheroRvrAsync` SDK was built for raspberry pi asyncio loop; may conflict with Jetson's event loop if not initialized correctly.
**Why it happens:** The SDK's `SerialAsyncDal` creates its own internal event loop management.
**How to avoid:** Initialize and use `SpheroRvrAsync` in the same event loop. Existing `RVRDriver.wake()` pattern (with `await asyncio.sleep(2)` after wake) is correct. Do not call SDK methods from different threads.

### Pitfall 4: instructor Library with Non-Pydantic-v2 Models
**What goes wrong:** `instructor` returns validation errors when using MissionJSON models from `models.py`.
**Why it happens:** The project uses Pydantic v2 (`>=2.0` in requirements.txt); `instructor` also requires v2. Mismatched Optional field handling between v1 and v2.
**How to avoid:** Ensure all models use `from __future__ import annotations` and Pydantic v2 syntax. Test with `pip show pydantic` version >= 2.0 confirmed.

### Pitfall 5: Base64 JPEG in WebSocket Messages
**What goes wrong:** Large key frames (1280×720 JPEG) cause WebSocket message size limits or UI lag.
**Why it happens:** Even at Q=60, a 1280×720 JPEG is ~80-120KB; base64-encoded = ~160KB per frame. At 30fps this saturates any channel.
**How to avoid:** Only send key frames on detection events, not every frame. Downsample to 640×480 or lower for key frames. Provide a config toggle (`VISION_KEYFRAME_ENABLED`, `VISION_KEYFRAME_RESOLUTION`). Default to off, enable explicitly.

### Pitfall 6: Coalition DID Constraint Enforcement
**What goes wrong:** Robot executes mission that violates national policy caveats (e.g., cross-border operation, engagement near civilians).
**Why it happens:** Pre-flight check reads from robot's DID document but DID document fields for national caveats are not defined/checked.
**How to avoid:** The pre-flight validator must query the ResourceRegistry for the robot's `specifications` field (which holds `autonomyLevel`, capability list) AND check the DAO decision's `autonomy_override` against the robot's declared level. Reject if mission command is outside declared capabilities.

---

## Code Examples

### Camera Mock for Simulate Mode
```python
# Source: pattern from existing rvr_driver.py simulate mode
class MockCamera:
    """Simulate mode camera — returns fixed mock detections."""
    def Capture(self):
        return None  # No CUDA image in simulate

class MockVisionEngine:
    def __init__(self):
        self._frame_count = 0

    async def detect_once(self, camera=None) -> list:
        self._frame_count += 1
        # Return mock detections every 5th frame for testing
        if self._frame_count % 5 == 0:
            return [{"class_desc": "person", "confidence": 0.85,
                     "left": 100, "top": 150, "right": 300, "bottom": 400,
                     "center_x": 200, "center_y": 275}]
        return []
```

### Pre-Flight Validation
```python
# robot/pre_flight.py — validates mission against DID document constraints
from models import MissionJSON
from typing import Optional

SUPPORTED_COMMANDS = {"patrol_route", "find_engage", "recon_area",
                      "visual_search", "overwatch", "resupply_route"}

VISION_COMMANDS = {"recon_area", "visual_search", "overwatch", "resupply_route"}

def validate_mission(
    mission: MissionJSON,
    robot_capabilities: list[str],
    autonomy_level: int,  # from DID document / resource specs
) -> Optional[str]:
    """
    Returns None if mission passes pre-flight, or a rejection reason string.
    """
    if mission.command not in SUPPORTED_COMMANDS:
        return f"Unsupported command: {mission.command}"

    if mission.command in VISION_COMMANDS and "vision" not in robot_capabilities:
        return f"Command {mission.command} requires vision capability not declared in DID"

    if mission.params.speed > mission.params.autonomy_policy.get("max_speed", 255):
        return f"Speed {mission.params.speed} exceeds authorized limit"

    # Lethal commands always require explicit auth (autonomy_policy check)
    if mission.command == "find_engage":
        if mission.params.autonomy_policy.get("lethal_effects_permitted", False):
            # find_engage with lethal intent — will gate on awaiting_auth (correct)
            pass

    return None  # passes
```

### Profile Resolution Pattern (Backend TypeScript)
```typescript
// backend/src/robot/mission-profile-service.ts pattern
export interface MissionProfile {
  name: string;
  max_speed: number;           // 0-255
  vision_cadence_ms: number;   // how often vision runs
  comms_cadence: 'continuous' | 'event' | 'minimal';
  obstacle_response: 'avoid' | 'stop_report' | 'log_continue';
  approach_behavior: 'stealth' | 'direct' | 'standard';
}

// Built-in default profiles
export const DEFAULT_PROFILES: Record<string, MissionProfile> = {
  stealth_recon: {
    name: 'stealth_recon',
    max_speed: 80,
    vision_cadence_ms: 500,
    comms_cadence: 'minimal',
    obstacle_response: 'avoid',
    approach_behavior: 'stealth',
  },
  direct_resupply: {
    name: 'direct_resupply',
    max_speed: 200,
    vision_cadence_ms: 1000,
    comms_cadence: 'event',
    obstacle_response: 'stop_report',
    approach_behavior: 'direct',
  },
  patrol: {
    name: 'patrol',
    max_speed: 120,
    vision_cadence_ms: 250,
    comms_cadence: 'continuous',
    obstacle_response: 'log_continue',
    approach_behavior: 'standard',
  },
};
```

---

## Codebase Integration Points (from Direct Code Analysis)

### What Currently Exists (HIGH confidence)

**`robot/models.py`** — Must extend:
- Add `profile_name: Optional[str]` to `MissionParams`
- Add `area: Optional[Dict]` to `MissionParams` (bounding box for sweep missions)
- Add `reference_image_b64: Optional[str]` to `MissionParams` (visual_search)
- Add new command values to `MissionJSON` (currently hard-coded in executor)
- Add `VisionMsg`, `DetectionResult` new classes

**`robot/mission_executor.py`** — Must extend:
- `supported_commands` set: add `recon_area`, `visual_search`, `overwatch`, `resupply_route`
- Add `_execute_recon_area()`, `_execute_visual_search()`, `_execute_overwatch()`, `_execute_resupply_route()` behavior handlers
- Add `_vision_engine` and `_send_vision_fn` as constructor parameters
- Add `_vision_loop()` helper that fires `send_vision_fn` based on profile cadence

**`robot/mission_client.py`** — Must extend:
- `capabilities` list in `_build_register_msg()` — add new capability strings
- `receive_loop()` — handle `robot:vision` ack; handle `profile` resolution response if added
- Initialize `VisionEngine` and pass to `MissionExecutor`
- Add vision message sender callback

**`robot/config.py`** — Must extend:
```python
VISION_ENABLED: bool = _optional("VISION_ENABLED", "true").lower() in ("true", "1")
VISION_MODEL: str = _optional("VISION_MODEL", "ssd-mobilenet-v2")
VISION_THRESHOLD: float = float(_optional("VISION_THRESHOLD", "0.5"))
CAMERA_SENSOR_ID: int = int(_optional("CAMERA_SENSOR_ID", "0"))
KEYFRAME_ENABLED: bool = _optional("KEYFRAME_ENABLED", "false").lower() in ("true", "1")
KEYFRAME_JPEG_QUALITY: int = int(_optional("KEYFRAME_JPEG_QUALITY", "50"))
INTENT_LLM_ENABLED: bool = _optional("INTENT_LLM_ENABLED", "true").lower() in ("true", "1")
OPENAI_API_KEY: str = _optional("OPENAI_API_KEY", "")
```

**`backend/src/robot/robot-types.ts`** — Must extend:
- `RobotWsMessageType` const: add `vision: 'robot:vision'`
- `MissionJSONSchema` z.enum: add new command strings
- `MissionJSONSchema` params: add `profile_name`, `area`, `reference_image_b64`
- Add `RobotVisionMsg` TypeScript interface
- Add `VisionDetection` sub-interface

**`backend/src/robot/robot-mission-service.ts`** — Must extend:
- `handleRobotMessage()` switch: add `robot:vision` case → `handleVisionMsg()`
- `dispatchMission()`: add profile resolution before dispatch
- New `resolveProfile(profile_name)` method → returns `MissionProfile`
- New `runPreFlightValidation(mission, robotDid)` method
- New `translateIntent(text, robot_id)` method → calls cloud LLM via instructor pattern

**`backend/src/resources/resource-registry.ts`** — Already has `findByCapability()`. No changes needed for Phase 44 core flow; capability strings on `RegisteredResource` drive the resource selection.

### DID Document Constraints in Phase 44 Context
The existing `ResourceRegistry` stores capabilities as `string[]` on `RegisteredResource`. National policy caveats and authority levels are in `specifications: Record<string, unknown>`. The pre-flight validator must:
1. Resolve robot's `RegisteredResource` by DID
2. Check `resource.capabilities` includes required capability for the mission command
3. Check `resource.specifications.autonomyLevel` is >= required level for the command
4. Check `resource.specifications.nationalCaveats` (new field to add) does not restrict mission
5. Trace DAO authorization: verify `mission.issued_by` resolves to an approved DAO decision with `ProposalStatus.Approved`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded YOLO classes | NanoOWL open-vocabulary detection | 2023-2024 | Can detect arbitrary objects by text description without retraining |
| SIFT (patented) | ORB (Apache 2.0) | 2011 | Free for commercial use; faster than SIFT; sufficient for target matching |
| Direct JSON prompting | `instructor` library with Pydantic | 2023-2024 | Automatic validation, retry, schema enforcement |
| Monolithic LLM response | Structured output / function calling | 2023 | Reliable schema adherence; no output parsing fragility |
| SLAM-first navigation | Vision-guided point-to-point with obstacle awareness | Ongoing | Practical for constrained rooms; SLAM deferred |

**Deprecated/outdated:**
- `imageNet` (image classification): Not used in Phase 44 — we need detection bounding boxes, not classification labels. Use `detectNet`.
- `segNet` (semantic segmentation): Not used in Phase 44 — NanoSAM/NanoOWL is better for our zero-shot use case.

---

## Open Questions

1. **VILA-2.7B on Jetson Orin Nano 8GB — fit?**
   - What we know: VILA-2.7B runs on Orin Nano 8GB per NVIDIA docs with 4-bit AWQ quantization; inference speed ~1-2 fps for scene queries.
   - What's unclear: Whether 8GB is enough alongside detectNet + Python runtime simultaneously, or if VLM must be a separate process.
   - Recommendation: Default to VLM being optional/disabled in config (`VISION_VLM_ENABLED=false`); enable explicitly. Accept 1-2 fps for scene description (called on demand, not every frame).

2. **Intent translation endpoint: robot-side vs backend-only?**
   - What we know: Context.md says dual execution — cloud for UI/DAO-originated, on-robot for local/direct.
   - What's unclear: What "local/direct" means for on-robot intent — most likely the template fallback is the "local" path.
   - Recommendation: Phase 44 builds the cloud path (backend endpoint + `instructor`) and the template fallback (robot-side). A true on-device small LLM is future work.

3. **Sweep path coordinate system — room-relative vs GPS?**
   - What we know: All existing navigation uses room-relative meters (x, y). `drive_to_point(x, y)` takes room meters. The calibration profile converts to geo for the COP map.
   - What's unclear: For AI-planned sweep, do coordinates come as room-relative or as a described area (e.g., "sector 4")?
   - Recommendation: Sweep path planner takes room-relative bounding box `{x_min, y_min, x_max, y_max}` in `MissionParams.area`. The intent translator (LLM) maps named areas to room-relative coords using a named-area registry.

4. **DAO decision traceability in pre-flight check**
   - What we know: DAO types exist in `backend/src/dao/types.ts` with `ProposalStatus.Approved` and `ProposalKind.MissionOrder`. The `mission.issued_by` field holds a DID.
   - What's unclear: Whether there's a queryable index from `issued_by` DID to DAO proposal. No `dao-store.ts` query by issued_by DID was found.
   - Recommendation: Pre-flight check validates `issued_by` DID format and that a proposal record exists and is `Approved`. If DAO store doesn't support this query, add a lightweight check (validate DID format + capability match) and flag full DAO trace as a Phase 44 stretch goal.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.23 |
| Config file | `robot/pytest.ini` (exists: `asyncio_mode = auto`, `testpaths = tests`) |
| Quick run command | `cd robot && python -m pytest tests/test_models.py tests/test_vision.py -x` |
| Full suite command | `cd robot && python -m pytest tests/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | VisionMsg Pydantic model validates correctly | unit | `pytest tests/test_vision_models.py -x` | Wave 0 |
| VIS-02 | DetectionResult serializes to JSON with correct fields | unit | `pytest tests/test_vision_models.py::test_detection_result_serialization -x` | Wave 0 |
| VIS-03 | FeatureMatcher.set_reference returns False for invalid image | unit | `pytest tests/test_feature_matcher.py::test_invalid_reference -x` | Wave 0 |
| VIS-04 | FeatureMatcher.match returns found=False with no reference set | unit | `pytest tests/test_feature_matcher.py::test_match_no_reference -x` | Wave 0 |
| VIS-05 | MockVisionEngine returns mock detections in simulate mode | unit | `pytest tests/test_vision_engine_simulate.py -x` | Wave 0 |
| EXEC-01 | MissionExecutor rejects unsupported commands | unit | `pytest tests/test_mission_executor.py::test_unsupported_command -x` | exists |
| EXEC-02 | MissionExecutor handles recon_area command accepted state | unit | `pytest tests/test_mission_executor.py::test_recon_area_accepted -x` | Wave 0 |
| EXEC-03 | MissionExecutor handles visual_search command accepted state | unit | `pytest tests/test_mission_executor.py::test_visual_search_accepted -x` | Wave 0 |
| SWEEP-01 | Boustrophedon sweep generates non-empty waypoint list | unit | `pytest tests/test_sweep.py::test_sweep_generates_waypoints -x` | Wave 0 |
| SWEEP-02 | Sweep path covers full area bounds | unit | `pytest tests/test_sweep.py::test_sweep_full_coverage -x` | Wave 0 |
| INT-01 | Template fallback returns correct command for "recon" keyword | unit | `pytest tests/test_intent.py::test_template_recon -x` | Wave 0 |
| INT-02 | Template fallback returns None for unknown input | unit | `pytest tests/test_intent.py::test_template_unknown -x` | Wave 0 |
| PRE-01 | Pre-flight rejects mission with unsupported command | unit | `pytest tests/test_pre_flight.py::test_unsupported_command -x` | Wave 0 |
| PRE-02 | Pre-flight rejects vision mission when capability missing | unit | `pytest tests/test_pre_flight.py::test_missing_vision_capability -x` | Wave 0 |
| MODEL-01 | MissionParams accepts new profile_name field | unit | `pytest tests/test_robot_models.py::test_mission_params_profile_name -x` | Wave 0 |
| MODEL-02 | MissionParams accepts area and reference_image_b64 | unit | `pytest tests/test_robot_models.py::test_mission_params_new_fields -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd robot && python -m pytest tests/test_robot_models.py tests/test_vision_models.py -x`
- **Per wave merge:** `cd robot && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `robot/tests/test_vision_models.py` — covers VIS-01, VIS-02
- [ ] `robot/tests/test_feature_matcher.py` — covers VIS-03, VIS-04 (no hardware needed; pure OpenCV)
- [ ] `robot/tests/test_vision_engine_simulate.py` — covers VIS-05 (mock engine only)
- [ ] `robot/tests/test_sweep.py` — covers SWEEP-01, SWEEP-02
- [ ] `robot/tests/test_intent.py` — covers INT-01, INT-02 (template fallback only; no LLM call)
- [ ] `robot/tests/test_pre_flight.py` — covers PRE-01, PRE-02
- [ ] `robot/tests/test_robot_models.py` — add new assertions for MODEL-01, MODEL-02 (file exists, needs additions)

Note: jetson-inference hardware tests are manual-only (require physical Jetson + CSI camera). All automated tests use simulate mode or pure Python logic.

---

## Sources

### Primary (HIGH confidence)
- [dusty-nv/jetson-inference GitHub](https://github.com/dusty-nv/jetson-inference) — detectNet API, videoSource CSI URI, Python examples
- [NVIDIA-AI-IOT/nanoowl GitHub](https://github.com/NVIDIA-AI-IOT/nanoowl) — NanoOWL text-prompt API, TensorRT engine
- [NVIDIA-AI-IOT/nanosam GitHub](https://github.com/NVIDIA-AI-IOT/nanosam) — NanoSAM segmentation
- [OpenCV Feature Matching Docs](https://docs.opencv.org/4.x/dc/dc3/tutorial_py_matcher.html) — ORB + BFMatcher patterns
- [instructor Python library](https://python.useinstructor.com/) — Pydantic structured output pattern
- Existing codebase: `robot/mission_executor.py`, `robot/models.py`, `robot/rvr_driver.py`, `robot/config.py`, `robot/mission_client.py`, `robot/common/ws_protocol.py`, `backend/src/robot/robot-types.ts`, `backend/src/robot/robot-mission-service.ts`, `backend/src/robot/robot-ws.ts`, `backend/src/resources/resource-registry.ts`, `backend/src/resources/types.ts`, `backend/src/dao/types.ts`

### Secondary (MEDIUM confidence)
- [NVIDIA Jetson Generative AI Blog](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics) — VILA-2.7B on Orin Nano 8GB
- [NVlabs/VILA GitHub](https://github.com/NVlabs/VILA) — VILA model family, AWQ quantization
- [Sphero SDK GitHub](https://github.com/sphero-inc/sphero-sdk-raspberrypi-python) — drive_with_heading timeout behavior
- [Boustrophedon CPP algorithm implementation](https://github.com/devanys/Coverage-Path-Planning-The-Boustrophedon-Cellular-Decomposition) — Python reference

### Tertiary (LOW confidence — WebSearch only)
- Multiple sources on VILA Orin Nano 8GB memory fit — needs hardware validation; documented as open question

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — jetson-inference is the definitive Jetson inference library; OpenCV ORB is well-documented; instructor is de-facto standard
- Architecture: HIGH — directly grounded in existing codebase code analysis
- Integration patterns: HIGH — read and analyzed all specified source files
- VLM model selection (VILA fit on 8GB): MEDIUM — NVIDIA blog confirms it works, but simultaneous detectNet + VLM memory fit needs hardware testing
- Pitfalls: HIGH — RVR+ timeout confirmed from Sphero SDK FAQ; async/threading pitfalls from existing code patterns

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (jetson-inference API stable; NanoOWL stable; check instructor for breaking changes)
