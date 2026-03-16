"""
Multi-robot detection confidence fusion.

Implements the Phase 47 weighted complementary probability formula for
fusing confidence scores from multiple robots that detect the same threat.

Formula:
  fused = 1 - product(1 - c * weight  for c in confidences)

This converges toward 1.0 as more independent sources corroborate a
detection — two robots at 0.7 confidence with weight 0.70 produces ~0.7399,
three produces ~0.867, etc.

Used by the robot agent for pre-computation before sending to backend,
and by the backend vision-cop-pipeline for corroboration status.
"""

VISION_PIPELINE_WEIGHT = 0.70


def fuse_detection_confidence(
    detections: list[dict],
    source_weight: float = VISION_PIPELINE_WEIGHT,
) -> float:
    """
    Fuse confidence scores from multiple detections of the same threat.

    Uses complementary probability fusion: each detection reduces the
    probability of a miss, and the fused confidence is 1 minus the
    joint miss probability.

    Args:
        detections: List of detection dicts, each with a 'confidence' key
                    (float in [0.0, 1.0]).
        source_weight: Reliability weight for this source type.
                       Defaults to VISION_PIPELINE_WEIGHT (0.70).

    Returns:
        Fused confidence as float in (0.0, 1.0].
        Returns 0.0 for empty detections list.

    Example:
        fuse_detection_confidence([{"confidence": 0.7}, {"confidence": 0.7}])
        # => ~0.7399
    """
    if not detections:
        return 0.0

    product = 1.0
    for det in detections:
        confidence = det.get("confidence", 0.0)
        product *= 1.0 - confidence * source_weight

    return 1.0 - product
