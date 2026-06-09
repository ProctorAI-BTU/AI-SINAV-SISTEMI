"""
Face Detection Service — Birim Testleri

Test senaryoları:
  1. Geçersiz / boş base64 → FACE_NOT_FOUND
  2. Düz renk görüntü (yüz yok) → FACE_NOT_FOUND
  3. Sahte tek yüz görüntüsü → detector çalışıp hata vermemeli
  4. Response alanları eksiksiz mi?
  5. API /health endpoint'i çalışıyor mu?
  6. API /detect endpoint'i yanıt veriyor mu?

NOT: Gerçek yüz görüntüsü gerektiren testler için
     'tests/fixtures/face_sample.jpg' kullanılır.
     Dosya yoksa o testler atlanır (skip).
"""

import base64
import os
import sys
import pytest
import numpy as np
import cv2
from pathlib import Path
from fastapi.testclient import TestClient

# Proje kök dizinini sys.path'e ekle
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.main import app
from app.detector import FaceDetector
from app.utils import decode_base64_image, validate_image

# ── Test client ────────────────────────────────────────────────────────────────
client = TestClient(app)
detector = FaceDetector()

# ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────────

def make_blank_image_b64(width: int = 320, height: int = 240, color=(50, 50, 50)) -> str:
    """Düz renkli boş görüntü üretir ve base64'e çevirir (yüz yok)."""
    img = np.full((height, width, 3), color, dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf).decode("utf-8")


def load_fixture_b64(filename: str) -> str | None:
    """fixtures/ klasöründen görüntü yükler. Dosya yoksa None döner."""
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
        assert isinstance(img, np.ndarray)

    def test_decode_invalid_base64(self):
        img = decode_base64_image("bu-gecersiz-bir-base64!!!")
        assert img is None

    def test_decode_empty_string(self):
        img = decode_base64_image("")
        assert img is None

    def test_validate_valid_image(self):
        b64 = make_blank_image_b64()
        img = decode_base64_image(b64)
        assert validate_image(img) is True

    def test_validate_none(self):
        assert validate_image(None) is False

    def test_validate_too_small(self):
        tiny = np.zeros((10, 10, 3), dtype=np.uint8)
        assert validate_image(tiny) is False


# ── Detector Testleri ──────────────────────────────────────────────────────────

class TestFaceDetector:
    def test_returns_dict(self):
        b64 = make_blank_image_b64()
        result = detector.detect(b64)
        assert isinstance(result, dict)

    def test_required_fields_present(self):
        b64 = make_blank_image_b64()
        result = detector.detect(b64)
        required = {"face_detected", "multiple_faces", "face_count", "confidence", "event_type", "message"}
        assert required.issubset(result.keys())

    def test_blank_image_no_face(self):
        """Düz renkli görüntüde yüz bulunmamalı."""
        b64 = make_blank_image_b64()
        result = detector.detect(b64)
        assert result["face_detected"] is False
        assert result["face_count"] == 0
        assert result["event_type"] == "FACE_NOT_FOUND"

    def test_invalid_base64_no_face(self):
        result = detector.detect("INVALID_BASE64")
        assert result["face_detected"] is False
        assert result["event_type"] == "FACE_NOT_FOUND"

    def test_confidence_range(self):
        b64 = make_blank_image_b64()
        result = detector.detect(b64)
        assert 0.0 <= result["confidence"] <= 1.0

    @pytest.mark.skipif(
        load_fixture_b64("face_single.jpg") is None,
        reason="Fixture 'face_single.jpg' bulunamadı — gerçek görüntü testi atlandı"
    )
    def test_single_face_detected(self):
        """Tek yüzlü görüntü → FACE_OK."""
        b64 = load_fixture_b64("face_single.jpg")
        result = detector.detect(b64)
        assert result["face_detected"] is True
        assert result["multiple_faces"] is False
        assert result["event_type"] == "FACE_OK"
        assert result["face_count"] == 1

    @pytest.mark.skipif(
        load_fixture_b64("face_multiple.jpg") is None,
        reason="Fixture 'face_multiple.jpg' bulunamadı — gerçek görüntü testi atlandı"
    )
    def test_multiple_faces_detected(self):
        """Çoklu yüzlü görüntü → MULTIPLE_FACE_DETECTED."""
        b64 = load_fixture_b64("face_multiple.jpg")
        result = detector.detect(b64)
        assert result["multiple_faces"] is True
        assert result["event_type"] == "MULTIPLE_FACE_DETECTED"
        assert result["face_count"] >= 2


# ── API Testleri ───────────────────────────────────────────────────────────────

class TestAPI:
    def test_health_endpoint(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "face-detection-service"

    def test_detect_endpoint_returns_200(self):
        b64 = make_blank_image_b64()
        payload = {"session_id": "test-session-001", "image_base64": b64}
        response = client.post("/detect", json=payload)
        assert response.status_code == 200

    def test_detect_endpoint_response_schema(self):
        b64 = make_blank_image_b64()
        payload = {"session_id": "test-session-002", "image_base64": b64}
        response = client.post("/detect", json=payload)
        data = response.json()
        assert "session_id" in data
        assert data["session_id"] == "test-session-002"
        assert "face_detected" in data
        assert "event_type" in data
        assert "confidence" in data

    def test_detect_endpoint_missing_field(self):
        """Eksik alan → 422 Unprocessable Entity."""
        response = client.post("/detect", json={"session_id": "x"})
        assert response.status_code == 422

    def test_detect_endpoint_invalid_base64(self):
        """Geçersiz base64 → 200 ama FACE_NOT_FOUND."""
        payload = {"session_id": "test-session-003", "image_base64": "NOT_VALID_BASE64"}
        response = client.post("/detect", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["event_type"] == "FACE_NOT_FOUND"
