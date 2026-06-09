"""Rule-based risk scoring for proctoring events.

The scorer receives accumulated event counts for a session and converts them
into a bounded 0-100 score. Each event has a per-occurrence weight and a
maximum contribution so repeated low-severity events cannot dominate the whole
score by themselves.
"""

EVENT_RULES = {
    "FACE_NOT_FOUND": {
        "weight": 22.0,
        "max": 66.0,
        "reason": "Face was not detected",
    },
    "MULTIPLE_FACE_DETECTED": {
        "weight": 20.0,
        "max": 60.0,
        "reason": "Multiple faces were detected",
    },
    "GAZE_AWAY": {
        "weight": 5.0,
        "max": 25.0,
        "reason": "Gaze moved away from the screen",
    },
    "GAZE_WARNING": {
        "weight": 2.0,
        "max": 10.0,
        "reason": "Gaze briefly moved away from the screen",
    },
    "AUDIO_DETECTED": {
        "weight": 4.0,
        "max": 16.0,
        "reason": "2-3 seconds of audio activity was detected",
    },
    "SPEECH_DETECTED": {
        "weight": 6.0,
        "max": 24.0,
        "reason": "2-3 seconds of speech-like audio was detected",
    },
    "NOISE_DETECTED": {
        "weight": 3.0,
        "max": 12.0,
        "reason": "2-3 seconds of loud or suspicious noise was detected",
    },
    "PHONE_DETECTED": {
        "weight": 25.0,
        "max": 75.0,
        "reason": "A phone was detected",
    },
    "OBJECT_DETECTED": {
        "weight": 16.0,
        "max": 32.0,
        "reason": "A prohibited object was detected",
    },
    "PROHIBITED_OBJECT_DETECTED": {
        "weight": 22.0,
        "max": 44.0,
        "reason": "A prohibited object was detected",
    },
    "TAB_SWITCH": {
        "weight": 25.0,
        "max": 50.0,
        "reason": "Browser tab was switched",
    },
    "FULLSCREEN_EXIT": {
        "weight": 15.0,
        "max": 30.0,
        "reason": "Fullscreen mode was exited",
    },
    "SHORTCUT_ATTEMPT": {
        "weight": 10.0,
        "max": 20.0,
        "reason": "Keyboard shortcut attempt was detected",
    },
    "CONNECTION_LOST": {
        "weight": 5.0,
        "max": 15.0,
        "reason": "Connection was lost",
    },
}


def calculate_rule_based_score(event_counts: dict) -> tuple[float, list[str]]:
    """Calculate a bounded risk score from event counts."""
    total_score = 0.0
    reasons = []

    for event_type, raw_count in event_counts.items():
        rule = EVENT_RULES.get(event_type)
        if not rule:
            continue

        count = max(0, int(raw_count or 0))
        if count == 0:
            continue

        contribution = min(count * rule["weight"], rule["max"])
        total_score += contribution

        capped_note = " capped" if contribution == rule["max"] and count * rule["weight"] > rule["max"] else ""
        reasons.append(
            f"{rule['reason']} ({count}x, +{round(contribution, 1)}{capped_note})"
        )

    final_score = min(max(total_score, 0.0), 100.0)
    return round(final_score, 1), reasons


def get_risk_level(score: float) -> str:
    """Map numeric score to a stable risk level."""
    if score < 50:
        return "LOW"
    if score < 75:
        return "MEDIUM"
    if score < 90:
        return "HIGH"
    return "CRITICAL"
