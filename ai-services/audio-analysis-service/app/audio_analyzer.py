"""Simple audio activity detector for proctoring events.

The service accepts 16-bit PCM mono audio encoded as raw base64 or as a
browser-style data URL. It is intentionally lightweight: it does not do speech
recognition, only detects whether meaningful audio activity is present.
"""

import base64
import binascii
import logging

import numpy as np

logger = logging.getLogger(__name__)

AUDIO_THRESHOLD_DB = 55.0
MAX_AUDIO_BYTES = 2 * 1024 * 1024
MIN_SAMPLE_RATE = 8000
MAX_SAMPLE_RATE = 48000


class AudioAnalyzer:
    def analyze(self, audio_base64: str, sample_rate: int = 16000) -> dict:
        try:
            if sample_rate < MIN_SAMPLE_RATE or sample_rate > MAX_SAMPLE_RATE:
                return self._result(
                    False,
                    0.0,
                    0.0,
                    0.0,
                    "AUDIO_OK",
                    f"Unsupported sample rate: {sample_rate}",
                )

            audio_bytes = self._decode_audio(audio_base64)
            if not audio_bytes:
                return self._result(False, 0.0, 0.0, 0.0, "AUDIO_OK", "Audio data is empty.")

            if len(audio_bytes) > MAX_AUDIO_BYTES:
                return self._result(False, 0.0, 0.0, 0.0, "AUDIO_OK", "Audio data is too large.")

            if len(audio_bytes) % 2 != 0:
                audio_bytes = audio_bytes[:-1]

            samples = np.frombuffer(audio_bytes, dtype="<i2").astype(np.float32)
            if samples.size == 0:
                return self._result(False, 0.0, 0.0, 0.0, "AUDIO_OK", "Audio data is empty.")

            duration = samples.size / sample_rate
            avg_db, peak_db = self._calculate_levels(samples)
            
            # Zero-Crossing Rate (ZCR) ile insan sesi / gurultu ayrimi
            # Insan sesi genelde 0.02 ile 0.4 arasinda bir ZCR'ye sahiptir
            zcr = float(np.mean(np.diff(np.sign(samples)) != 0))
            is_speech_like = 0.02 < zcr < 0.4

            audio_detected = bool(avg_db >= AUDIO_THRESHOLD_DB)

            if audio_detected and is_speech_like:
                event_type = "SPEECH_DETECTED"
                message = "Insan sesi algilandi (Kopya riski!)."
            elif audio_detected:
                event_type = "NOISE_DETECTED"
                message = "Gurultu veya farkli bir ses (klavye/tikirti vb.) algilandi."
            else:
                event_type = "AUDIO_OK"
                message = "Ortam sessiz ve uygun."

            return self._result(
                audio_detected,
                avg_db,
                peak_db,
                duration,
                event_type,
                message,
            )

        except Exception as exc:
            logger.exception("Audio analysis failed.")
            return self._result(False, 0.0, 0.0, 0.0, "AUDIO_OK", f"Error: {exc}")

    @staticmethod
    def _decode_audio(audio_base64: str) -> bytes | None:
        if not audio_base64 or not isinstance(audio_base64, str):
            return None

        if "," in audio_base64 and audio_base64.lstrip().startswith("data:"):
            audio_base64 = audio_base64.split(",", 1)[1]

        audio_base64 = audio_base64.strip()
        padding = 4 - len(audio_base64) % 4
        if padding != 4:
            audio_base64 += "=" * padding

        try:
            return base64.b64decode(audio_base64, validate=True)
        except (binascii.Error, ValueError):
            return None

    @staticmethod
    def _calculate_levels(samples: np.ndarray) -> tuple[float, float]:
        normalized = samples / 32768.0
        rms = float(np.sqrt(np.mean(normalized**2)))
        peak = float(np.max(np.abs(normalized)))

        avg_dbfs = 20 * np.log10(max(rms, 1e-8))
        peak_dbfs = 20 * np.log10(max(peak, 1e-8))

        # Convert dBFS [-80..0] to a simple 0..100 score for UI/risk use.
        avg_score = max(0.0, min(100.0, avg_dbfs + 100.0))
        peak_score = max(0.0, min(100.0, peak_dbfs + 100.0))
        return round(avg_score, 1), round(peak_score, 1)

    @staticmethod
    def _result(
        audio_detected: bool,
        avg_db: float,
        peak_db: float,
        duration_seconds: float,
        event_type: str,
        message: str,
    ) -> dict:
        return {
            "audio_detected": audio_detected,
            "avg_db": round(avg_db, 1),
            "peak_db": round(peak_db, 1),
            "duration_seconds": round(duration_seconds, 2),
            "event_type": event_type,
            "message": message,
        }


analyzer = AudioAnalyzer()
