"""One-shot manual tester for camera and audio AI services."""

import base64
import sys

try:
    import cv2
    import numpy as np
    import requests
except ImportError:
    print("Missing dependency. Install into this project's .deps folder.")
    sys.exit(1)

FACE_SERVICE_URL = "http://127.0.0.1:8091"
EYE_SERVICE_URL = "http://127.0.0.1:8092"
AUDIO_SERVICE_URL = "http://127.0.0.1:8093"
SESSION_ID = "webcam-test-session"


def capture_frame_as_base64() -> str | None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Webcam could not be opened.")
        return None
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print("Frame could not be captured.")
        return None
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")


def make_audio_base64(kind: str, sample_rate: int = 16000, seconds: float = 1.0) -> str:
    if kind == "tone":
        t = np.linspace(0, seconds, int(sample_rate * seconds), endpoint=False)
        samples = (np.sin(2 * np.pi * 440 * t) * 12000).astype("<i2")
    else:
        samples = np.zeros(int(sample_rate * seconds), dtype="<i2")
    payload = base64.b64encode(samples.tobytes()).decode("utf-8")
    return "data:audio/pcm;base64," + payload


def check_service_health(url: str, name: str) -> bool:
    try:
        response = requests.get(f"{url}/health", timeout=3)
        if response.status_code == 200 and response.json().get("status") == "healthy":
            print(f"[OK] {name} is running")
            return True
    except Exception:
        pass
    print(f"[DOWN] {name} is not reachable ({url})")
    return False


def test_face_detection(image_b64: str):
    print("\n-- Face Detection -------------------------")
    try:
        response = requests.post(
            f"{FACE_SERVICE_URL}/detect",
            json={"session_id": SESSION_ID, "image_base64": image_b64},
            timeout=10,
        )
        data = response.json()
        print(f"Event      : {data['event_type']}")
        print(f"Detected   : {data['face_detected']}")
        print(f"Face count : {data['face_count']}")
        print(f"Confidence : {data['confidence']:.2f}")
        print(f"Message    : {data['message']}")
    except Exception as exc:
        print(f"Error: {exc}")


def test_eye_tracking(image_b64: str):
    print("\n-- Eye Tracking ---------------------------")
    try:
        response = requests.post(
            f"{EYE_SERVICE_URL}/track",
            json={"session_id": SESSION_ID, "image_base64": image_b64},
            timeout=10,
        )
        data = response.json()
        print(f"Event      : {data['event_type']}")
        print(f"Gaze       : {data['gaze']}")
        print(f"Confidence : {data['confidence']:.2f}")
        print(f"Away time  : {data['duration_away_seconds']}s")
        print(f"Message    : {data['message']}")
    except Exception as exc:
        print(f"Error: {exc}")


def test_audio_analysis():
    print("\n-- Audio Analysis -------------------------")
    for label, audio_b64 in [
        ("silence", make_audio_base64("silence")),
        ("tone", make_audio_base64("tone")),
    ]:
        try:
            response = requests.post(
                f"{AUDIO_SERVICE_URL}/analyze",
                json={
                    "session_id": SESSION_ID,
                    "audio_base64": audio_b64,
                    "sample_rate": 16000,
                },
                timeout=10,
            )
            data = response.json()
            print(
                f"{label:7} -> {data['event_type']} "
                f"avg={data['avg_db']:.1f} peak={data['peak_db']:.1f} "
                f"duration={data['duration_seconds']:.2f}s"
            )
        except Exception as exc:
            print(f"{label:7} -> Error: {exc}")


def main():
    print("=" * 50)
    print("  AI Exam System - Manual Camera/Audio Test")
    print("=" * 50)

    print("\n[1] Service status:")
    face_ok = check_service_health(FACE_SERVICE_URL, "Face Detection (8091)")
    eye_ok = check_service_health(EYE_SERVICE_URL, "Eye Tracking  (8092)")
    audio_ok = check_service_health(AUDIO_SERVICE_URL, "Audio Analysis (8093)")

    if not face_ok and not eye_ok and not audio_ok:
        print("\nNo AI service is reachable.")
        sys.exit(1)

    image_b64 = None
    if face_ok or eye_ok:
        print("\n[2] Capturing one webcam frame...")
        image_b64 = capture_frame_as_base64()
        if image_b64:
            print(f"Image size: {len(image_b64) // 1024} KB (base64)")

    print("\n[3] Service results:")
    if image_b64 and face_ok:
        test_face_detection(image_b64)
    if image_b64 and eye_ok:
        test_eye_tracking(image_b64)
    if audio_ok:
        test_audio_analysis()

    print("\n" + "=" * 50)
    print("Test complete.")


if __name__ == "__main__":
    main()
