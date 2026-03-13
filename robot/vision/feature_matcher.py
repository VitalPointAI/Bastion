"""
ORB-based feature matcher for visual reference image identification.

Implements FeatureMatcher using OpenCV's ORB detector and BFMatcher with
Lowe's ratio test to identify whether a reference image is present in a
captured camera frame.
"""
from __future__ import annotations

import numpy as np
import cv2
from typing import Optional

from robot.vision.models import TargetMatchResult


class FeatureMatcher:
    """Matches a live camera frame against a stored reference image.

    Uses ORB (Oriented FAST and Rotated BRIEF) keypoint detection with
    BFMatcher (Hamming distance) and Lowe's ratio test for reliable,
    hardware-independent feature matching.

    Parameters
    ----------
    n_features:
        Maximum ORB keypoints to extract per image (default 500).
    match_threshold:
        Lowe's ratio test threshold (default 0.75). Lower = stricter.
    """

    def __init__(self, n_features: int = 500, match_threshold: float = 0.75) -> None:
        self._orb = cv2.ORB_create(nfeatures=n_features)
        # NORM_HAMMING required for binary ORB descriptors; crossCheck=False for knnMatch
        self._matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        self._match_threshold = match_threshold
        self._kp_ref: Optional[tuple] = None
        self._desc_ref: Optional[np.ndarray] = None

    def set_reference(self, reference_image_bytes: bytes) -> bool:
        """Load and process a reference image from raw bytes.

        Parameters
        ----------
        reference_image_bytes:
            Raw image file bytes (JPEG, PNG, etc.).

        Returns
        -------
        bool
            True if the image decoded and produced sufficient keypoints; False otherwise.
        """
        if not reference_image_bytes:
            return False
        try:
            buf = np.frombuffer(reference_image_bytes, dtype=np.uint8)
            img = cv2.imdecode(buf, cv2.IMREAD_GRAYSCALE)
        except Exception:
            return False

        if img is None:
            return False

        kp, desc = self._orb.detectAndCompute(img, None)
        if len(kp) < 10:
            return False

        self._kp_ref = kp
        self._desc_ref = desc
        return True

    def match(self, frame_gray: np.ndarray) -> TargetMatchResult:
        """Match a grayscale camera frame against the stored reference.

        Parameters
        ----------
        frame_gray:
            Grayscale numpy array (H x W, dtype=uint8).

        Returns
        -------
        TargetMatchResult
            Result with found flag, confidence score, and good match count.
        """
        if self._desc_ref is None:
            return TargetMatchResult(found=False, confidence=0.0, match_count=0)

        kp_frame, desc_frame = self._orb.detectAndCompute(frame_gray, None)
        if len(kp_frame) < 4:
            return TargetMatchResult(found=False, confidence=0.0, match_count=0)

        # knnMatch requires at least 2 training descriptors for k=2
        if self._desc_ref is None or len(self._desc_ref) < 2:
            return TargetMatchResult(found=False, confidence=0.0, match_count=0)

        raw_matches = self._matcher.knnMatch(desc_frame, self._desc_ref, k=2)

        # Lowe's ratio test
        good_matches = []
        for pair in raw_matches:
            if len(pair) == 2:
                m, n = pair
                if m.distance < self._match_threshold * n.distance:
                    good_matches.append(m)

        n_ref = max(len(self._kp_ref), 1)
        confidence = min(len(good_matches) / n_ref, 1.0)
        found = len(good_matches) >= 10

        return TargetMatchResult(found=found, confidence=confidence, match_count=len(good_matches))

    def clear_reference(self) -> None:
        """Remove the stored reference image and descriptors."""
        self._kp_ref = None
        self._desc_ref = None
