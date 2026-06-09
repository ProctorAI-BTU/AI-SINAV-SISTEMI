"""Manual smoke tester for the risk scoring service.

Usage:
    python test_risk_scoring.py
"""

import requests


RISK_SERVICE_URL = "http://127.0.0.1:8094"
SESSION_ID = "manual-risk-test-session"


def post_event(event_type: str):
    response = requests.post(
        f"{RISK_SERVICE_URL}/analyze",
        json={
            "session_id": SESSION_ID,
            "event_type": event_type,
            "payload": {},
            "risk_impact": 0.0,
        },
        timeout=5,
    )
    response.raise_for_status()
    return response.json()["data"]


def print_score(label: str, score_data: dict):
    print(
        f"{label:<24} score={score_data['risk_score']:>5.1f} "
        f"level={score_data['risk_level']:<8} counts={score_data['event_counts']}"
    )


def main():
    health = requests.get(f"{RISK_SERVICE_URL}/health", timeout=5)
    health.raise_for_status()
    print("[OK] Risk scoring service is running")

    requests.delete(f"{RISK_SERVICE_URL}/score/{SESSION_ID}", timeout=5)

    events = [
        "FACE_NOT_FOUND",
        "FACE_NOT_FOUND",
        "GAZE_AWAY",
        "GAZE_AWAY",
        "GAZE_AWAY",
        "AUDIO_DETECTED",
        "MULTIPLE_FACE_DETECTED",
        "FULLSCREEN_EXIT",
    ]

    for event_type in events:
        score_data = post_event(event_type)
        print_score(event_type, score_data)

    final_score = requests.get(f"{RISK_SERVICE_URL}/score/{SESSION_ID}", timeout=5).json()
    print("\nReasons:")
    for reason in final_score["reasons"]:
        print(f"- {reason}")


if __name__ == "__main__":
    main()
