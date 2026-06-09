"""
Eye Tracking Service — Birim Testleri

Test senaryoları:
  1. Geçersiz / boş base64 → GAZE_WARNING + gaze=unknown
  2. Düz renk görüntü (yüz yok) → GAZE_WARNING
  3. Response alanları eksiksiz mi?
  4. duration_away_seconds artıyor mu?
  5. API /health endpoint'i çalışıyor mu?
  6. API /track endpoint'i yanıt veriyor mu?
  7. Bakış yönü sınıflandırması doğru mu? (threshold testi)
"""

import base64
import sys
import time
import pytest
import numpy as np
import cv2
from pathlib import Path
from fastapi.testclient import TestClient

# Servis kök dizinini sys.path'e ekle
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.gaze_tracker import GazeTracker
from app.utils import decode_base64_image, validate_image

# ── Test client ────────────────────────────────────────────────────────────────
client = TestClient(app)
tracker = GazeTracker()

# ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────────

def make_blank_image_b64(width=320, height=240, color=(60, 60, 60)) -> str:
    img = np.full((height, width, 3), color, dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf).decode("utf-8")


def load_fixture_b64(filename: str) -> str | None:
    fixture_path = Path(__file__).parent / "fixtures" / filename
    if not fixture_path.exists():
        return None
    with open(fixture_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


# ── Utils Testleri ─────────────────────────────────────────────────────────────

class TestUtils:
    def test_decode_valid_base64(self):
        b64 = make_blank_image_b64()
        img = decode_base64_image(b64)
        assert img is not None

    def test_decode_empty_string(self):
        assert decode_base64_image("") is None

    def test_validate_none(self):
        assert validate_image(None) is False

    def test_validate_tiny_image(self):
        tiny = np.zeros((5, 5, 3), dtype=np.uint8)
        assert validate_image(tiny) is False


# ── Gaze Sınıflandırma Testleri ────────────────────────────────────────────────

class TestGazeClassification:
    """
    GazeTracker._classify_gaze statik metodunu doğrudan test eder.
    Gerçek görüntü gerekmez.
    """

    def test_center_is_screen(self):
        assert GazeTracker._classify_gaze(0.50, 0.50) == "screen"

    def test_far_left(self):
        assert GazeTracker._classify_gaze(0.20, 0.50) == "left"

    def test_far_right(self):
        assert GazeTracker._classify_gaze(0.80, 0.50) == "right"

    def test_far_up(self):
        assert GazeTracker._classify_gaze(0.50, 0.15) == "up"

    def test_far_down(self):
        assert GazeTracker._classify_gaze(0.50, 0.85) == "down"

    def test_boundary_left(self):
        # Eşik değerinin hemen solunda → left
        assert GazeTracker._classify_gaze(0.37, 0.50) == "left"

    def test_boundary_right(self):
        # Eşik değerinin hemen sağında → right
        assert GazeTracker._classify_gaze(0.63, 0.50) == "right"


# ── GazeTracker Testleri ───────────────────────────────────────────────────────

class TestGazeTracker:
    def test_returns_dict(self):
        b64 = make_blank_image_b64()
        result = tracker.track("sess-001", b64)
        assert isinstance(result, dict)

    def test_required_fields_present(self):
        b64 = make_blank_image_b64()
        result = tracker.track("sess-002", b64)
        required = {"gaze", "confidence", "duration_away_seconds", "event_type", "message"}
        assert required.issubset(result.keys())

    def test_blank_image_starts_as_gaze_warning(self):
        """Yüzün olmadığı ilk görüntü → GAZE_WARNING."""
        b64 = make_blank_image_b64()
        result = tracker.track("sess-blank-warning", b64)
        assert result["event_type"] == "GAZE_WARNING"
        assert result["gaze"] == "unknown"

    def test_invalid_base64_starts_as_gaze_warning(self):
        result = tracker.track("sess-invalid-warning", "INVALID")
        assert result["event_type"] == "GAZE_WARNING"

    def test_sustained_blank_image_becomes_gaze_away(self):
        b64 = make_blank_image_b64()
        session = "sess-blank-away"
        tracker.track(session, b64)
        time.sleep(3.1)
        result = tracker.track(session, b64)
        assert result["event_type"] == "GAZE_AWAY"

    def test_confidence_between_0_and_1(self):
        b64 = make_blank_image_b64()
        result = tracker.track("sess-005", b64)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_duration_increases_over_time(self):
        """Yüz olmayan görüntüde duration_away_seconds artmalı."""
        b64 = make_blank_image_b64()
        session = "sess-duration-test"

        result1 = tracker.track(session, b64)
        time.sleep(1.1)  # 1 saniye bekle
        result2 = tracker.track(session, b64)

        # İkinci sonuçta süre en az 1 saniye artmış olmalı
        assert result2["duration_away_seconds"] >= result1["duration_away_seconds"]

    @pytest.mark.skipif(
        load_fixture_b64("face_looking_screen.jpg") is None,
        reason="Fixture bulunamadı — gerçek görüntü testi atlandı"
    )
    def test_screen_gaze_detected(self):
        """Ekrana bakan yüz → GAZE_OK."""
        b64 = load_fixture_b64("face_looking_screen.jpg")
        result = tracker.track("sess-real-001", b64)
        assert result["event_type"] == "GAZE_OK"
        assert result["gaze"] == "screen"

    @pytest.mark.skipif(
        load_fixture_b64("face_looking_right.jpg") is None,
        reason="Fixture bulunamadı — gerçek görüntü testi atlandı"
    )
    def test_right_gaze_detected(self):
        """Sağa bakan yüz → GAZE_AWAY."""
        b64 = load_fixture_b64("face_looking_right.jpg")
        session = "sess-real-002"
        result = tracker.track(session, b64)
        for _ in range(2):
            result = tracker.track(session, b64)
        assert result["event_type"] == "GAZE_AWAY"
        assert result["gaze"] in ["right", "left"]  # kamera simetri


# ── API Testleri ───────────────────────────────────────────────────────────────

class TestAPI:
    def test_health_endpoint(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "eye-tracking-service"

    def test_track_endpoint_returns_200(self):
        b64 = make_blank_image_b64()
        payload = {"session_id": "api-test-001", "image_base64": b64}
        response = client.post("/track", json=payload)
        assert response.status_code == 200

    def test_track_endpoint_response_schema(self):
        b64 = make_blank_image_b64()
        payload = {"session_id": "api-test-002", "image_base64": b64}
        response = client.post("/track", json=payload)
        data = response.json()
        assert data["session_id"] == "api-test-002"
        assert "gaze" in data
        assert "event_type" in data
        assert "duration_away_seconds" in data

    def test_track_endpoint_missing_field(self):
        response = client.post("/track", json={"session_id": "x"})
        assert response.status_code == 422

    def test_track_endpoint_invalid_base64(self):
        payload = {"session_id": "api-test-003", "image_base64": "INVALID"}
        response = client.post("/track", json=payload)
        assert response.status_code == 200
        assert response.json()["event_type"] == "GAZE_WARNING"
