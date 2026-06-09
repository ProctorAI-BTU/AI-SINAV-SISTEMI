import base64
import sys
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.audio_analyzer import AudioAnalyzer
from app.main import app

client = TestClient(app)
analyzer = AudioAnalyzer()


def pcm16_base64(samples: np.ndarray, data_url: bool = False) -> str:
    payload = base64.b64encode(samples.astype("<i2").tobytes()).decode("utf-8")
    if data_url:
        return f"data:audio/pcm;base64,{payload}"
    return payload


def make_silence(sample_rate: int = 16000, seconds: float = 1.0) -> str:
    samples = np.zeros(int(sample_rate * seconds), dtype=np.int16)
    return pcm16_base64(samples)


def make_tone(sample_rate: int = 16000, seconds: float = 1.0, amplitude: int = 12000) -> str:
    t = np.linspace(0, seconds, int(sample_rate * seconds), endpoint=False)
    samples = np.sin(2 * np.pi * 440 * t) * amplitude
    return pcm16_base64(samples.astype(np.int16), data_url=True)


class TestAudioAnalyzer:
    def test_silence_is_audio_ok(self):
        result = analyzer.analyze(make_silence(), 16000)
        assert result["audio_detected"] is False
        assert result["event_type"] == "AUDIO_OK"

    def test_tone_is_audio_detected(self):
        result = analyzer.analyze(make_tone(), 16000)
        assert result["audio_detected"] is True
        assert result["event_type"] == "AUDIO_DETECTED"
        assert result["avg_db"] >= 55.0

    def test_invalid_base64_is_safe(self):
        result = analyzer.analyze("not-valid-base64!", 16000)
        assert result["audio_detected"] is False
        assert result["event_type"] == "AUDIO_OK"

    def test_unsupported_sample_rate_is_safe(self):
        result = analyzer.analyze(make_silence(), 4000)
        assert result["audio_detected"] is False
        assert result["event_type"] == "AUDIO_OK"


class TestAPI:
    def test_health_endpoint(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_analyze_endpoint_silence(self):
        response = client.post(
            "/analyze",
            json={
                "session_id": "audio-test-001",
                "audio_base64": make_silence(),
                "sample_rate": 16000,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "audio-test-001"
        assert data["event_type"] == "AUDIO_OK"

    def test_analyze_endpoint_tone(self):
        response = client.post(
            "/analyze",
            json={
                "session_id": "audio-test-002",
                "audio_base64": make_tone(),
                "sample_rate": 16000,
            },
        )
        assert response.status_code == 200
        assert response.json()["event_type"] == "AUDIO_DETECTED"
