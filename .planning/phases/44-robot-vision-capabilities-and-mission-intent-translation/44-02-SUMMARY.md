---
phase: 44-robot-vision-capabilities-and-mission-intent-translation
plan: "02"
subsystem: robot-vision
tags: [jetson, detectnet, asyncio, simulate, camera, opencv, vision-engine]

# Dependency graph
requires:
  - phase: 44-01
    provides: "DetectionResult, VisionConfig pydantic models and robot/vision package structure"

provides:
  - "Camera class wrapping jetson.utils.videoSource with MockCamera simulate fallback"
  - "VisionEngine wrapping jetson-inference detectNet with async detect_once via asyncio.to_thread"
  - "MockVisionEngine returning periodic mock DetectionResult every 5th frame"
  - "6 passing simulate-mode tests covering all engine and camera behaviors"

affects:
  - 44-03
  - 44-04
  - 44-05
  - 44-06
  - 44-07
  - 44-08

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard all jetson.utils / jetson.inference imports with try/except ImportError for CI portability"
    - "Use asyncio.to_thread to offload blocking GPU inference from the asyncio event loop"
    - "MockVisionEngine returns DetectionResult every 5th frame for predictable simulate-mode testing"

key-files:
  created:
    - robot/vision/camera.py
    - robot/vision/vision_engine.py
    - robot/tests/test_vision_engine_simulate.py
  modified: []

key-decisions:
  - "asyncio.to_thread used in VisionEngine.detect_once to keep event loop non-blocking during GPU inference"
  - "MockVisionEngine and MockCamera return deterministic test data (every 5th frame) rather than random, enabling reproducible unit tests"
  - "Camera.capture_jpeg carries a minimal embedded 1x1 JPEG constant for mock mode — no cv2 required in CI"

patterns-established:
  - "Pattern 1: All jetson hardware imports wrapped in try/except ImportError, falling back to Mock* classes"
  - "Pattern 2: VisionEngine delegates all async behavior to MockVisionEngine when simulate=True"

requirements-completed: [VIS-05]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 44 Plan 02: Vision Engine and Camera Module Summary

**detectNet wrapper (VisionEngine) and CSI camera module (Camera) with full simulate/CI fallback via MockVisionEngine and MockCamera, asyncio.to_thread for non-blocking inference**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-13T21:42:39Z
- **Completed:** 2026-03-13T21:44:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Camera module wraps jetson.utils.videoSource; falls back to MockCamera when unavailable (ImportError or simulate=True)
- VisionEngine wraps jetson-inference detectNet; falls back to MockVisionEngine when unavailable
- detect_once is async via asyncio.to_thread — blocking GPU inference never stalls the event loop
- MockVisionEngine returns a DetectionResult("person", 0.85) every 5th frame for predictable simulation
- All 6 tests pass on any machine without Jetson hardware

## Task Commits

Each task was committed atomically:

1. **Task 1: Create camera.py with CSI wrapper and MockCamera** - `ddf3510` (feat)
2. **Task 2: Create vision_engine.py with VisionEngine and MockVisionEngine** - `ceff4cd` (feat)

_Note: TDD tasks — tests written and confirmed failing before implementation for Task 2._

## Files Created/Modified
- `robot/vision/camera.py` - Camera / MockCamera with simulate fallback and JPEG capture
- `robot/vision/vision_engine.py` - VisionEngine / MockVisionEngine with async detect_once
- `robot/tests/test_vision_engine_simulate.py` - 6 simulate-mode unit tests

## Decisions Made
- Used `asyncio.to_thread` in `VisionEngine.detect_once` so blocking GPU calls don't stall the event loop; consistent with Python async best practices for CPU/IO-bound tasks
- MockVisionEngine returns every-5th-frame detection (deterministic) rather than random, enabling reliable test assertions
- Embedded a minimal 50-byte 1x1 pixel JPEG constant in MockCamera so `capture_jpeg` works without OpenCV or any hardware in CI

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures in `test_config.py` (REGISTRATION_TOKEN env var set) and `test_sweep.py` (robot.sweep.path_planner not yet created) — both out of scope for this plan, not introduced by these changes.

## Next Phase Readiness
- Camera and VisionEngine are ready for use by the vision loop (Plan 03) and mission types (Plans 05-08)
- MockVisionEngine enables full simulate-mode testing of all downstream plans without Jetson hardware
- Pattern established: all vision code guards jetson imports; downstream plans should follow same convention

---
*Phase: 44-robot-vision-capabilities-and-mission-intent-translation*
*Completed: 2026-03-13*
