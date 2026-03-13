"""Tests for robot/vision/feature_matcher.py: FeatureMatcher ORB-based matching."""
import numpy as np
import cv2
import pytest


def _make_test_image_bytes(pattern: str = "rectangles") -> bytes:
    """Create a simple test image encoded as JPEG bytes."""
    img = np.ones((200, 200, 3), dtype=np.uint8) * 255  # white background
    if pattern == "rectangles":
        cv2.rectangle(img, (20, 20), (80, 80), (0, 0, 0), -1)
        cv2.rectangle(img, (100, 100), (170, 170), (128, 128, 128), -1)
        cv2.circle(img, (50, 150), 30, (64, 64, 64), -1)
    elif pattern == "circles":
        cv2.circle(img, (50, 50), 40, (0, 0, 0), -1)
        cv2.circle(img, (150, 150), 40, (128, 0, 0), -1)
        cv2.rectangle(img, (60, 130), (140, 180), (0, 128, 0), -1)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    success, buf = cv2.imencode(".jpg", gray, [cv2.IMWRITE_JPEG_QUALITY, 95])
    assert success
    return buf.tobytes()


def _make_test_frame(pattern: str = "rectangles") -> np.ndarray:
    """Create a simple grayscale test frame as numpy array."""
    img = np.ones((200, 200, 3), dtype=np.uint8) * 255
    if pattern == "rectangles":
        cv2.rectangle(img, (20, 20), (80, 80), (0, 0, 0), -1)
        cv2.rectangle(img, (100, 100), (170, 170), (128, 128, 128), -1)
        cv2.circle(img, (50, 150), 30, (64, 64, 64), -1)
    elif pattern == "circles":
        cv2.circle(img, (50, 50), 40, (0, 0, 0), -1)
        cv2.circle(img, (150, 150), 40, (128, 0, 0), -1)
        cv2.rectangle(img, (60, 130), (140, 180), (0, 128, 0), -1)
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


class TestFeatureMatcherInvalidReference:
    """FeatureMatcher handles invalid/corrupt reference images gracefully."""

    def test_invalid_reference_random_bytes(self):
        """set_reference with random non-image bytes returns False."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher()
        result = fm.set_reference(b"\x00\xff\xab\xcd" * 100)
        assert result is False

    def test_invalid_reference_empty_bytes(self):
        """set_reference with empty bytes returns False."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher()
        result = fm.set_reference(b"")
        assert result is False

    def test_invalid_reference_text_data(self):
        """set_reference with text data returns False."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher()
        result = fm.set_reference(b"this is not an image file at all")
        assert result is False


class TestFeatureMatcherNoReference:
    """FeatureMatcher match() without a reference returns found=False."""

    def test_match_no_reference_returns_not_found(self):
        """match() without calling set_reference returns TargetMatchResult(found=False, confidence=0.0)."""
        from robot.vision.feature_matcher import FeatureMatcher
        from robot.vision.models import TargetMatchResult
        fm = FeatureMatcher()
        frame = _make_test_frame()
        result = fm.match(frame)
        assert isinstance(result, TargetMatchResult)
        assert result.found is False
        assert result.confidence == 0.0
        assert result.match_count == 0

    def test_match_after_clear_reference_returns_not_found(self):
        """match() after clear_reference() returns found=False."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher()
        img_bytes = _make_test_image_bytes()
        fm.set_reference(img_bytes)
        fm.clear_reference()
        frame = _make_test_frame()
        result = fm.match(frame)
        assert result.found is False
        assert result.confidence == 0.0


class TestFeatureMatcherValidReference:
    """FeatureMatcher correctly sets a valid reference image."""

    def test_set_valid_reference_returns_true(self):
        """set_reference with valid JPEG bytes returns True."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher()
        img_bytes = _make_test_image_bytes()
        result = fm.set_reference(img_bytes)
        assert result is True

    def test_set_reference_constructor_params(self):
        """FeatureMatcher accepts n_features and match_threshold constructor params."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher(n_features=200, match_threshold=0.8)
        img_bytes = _make_test_image_bytes()
        result = fm.set_reference(img_bytes)
        assert result is True


class TestFeatureMatcherMatchBehavior:
    """FeatureMatcher match() correctly identifies and rejects frames."""

    def test_match_identical_image_returns_found(self):
        """Matching the reference image against itself returns found=True and confidence > 0."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher()
        img_bytes = _make_test_image_bytes("rectangles")
        fm.set_reference(img_bytes)
        # Use the same frame
        frame = _make_test_frame("rectangles")
        result = fm.match(frame)
        assert result.found is True
        assert result.confidence > 0

    def test_match_different_image_lower_confidence(self):
        """Matching a different image returns lower confidence than matching the same image."""
        from robot.vision.feature_matcher import FeatureMatcher
        fm = FeatureMatcher()
        img_bytes = _make_test_image_bytes("rectangles")
        fm.set_reference(img_bytes)

        same_frame = _make_test_frame("rectangles")
        diff_frame = _make_test_frame("circles")

        same_result = fm.match(same_frame)
        diff_result = fm.match(diff_frame)

        # Same image should score >= different image
        assert same_result.confidence >= diff_result.confidence

    def test_match_returns_target_match_result(self):
        """match() always returns a TargetMatchResult instance."""
        from robot.vision.feature_matcher import FeatureMatcher
        from robot.vision.models import TargetMatchResult
        fm = FeatureMatcher()
        img_bytes = _make_test_image_bytes()
        fm.set_reference(img_bytes)
        frame = _make_test_frame()
        result = fm.match(frame)
        assert isinstance(result, TargetMatchResult)
        assert isinstance(result.found, bool)
        assert isinstance(result.confidence, float)
        assert isinstance(result.match_count, int)
        assert 0.0 <= result.confidence <= 1.0
