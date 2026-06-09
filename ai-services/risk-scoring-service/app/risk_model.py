"""
Risk model that combines rule-based scoring with optional ML model.
Manages per-session event accumulation and scoring.
"""
from collections import defaultdict
from .rule_based_score import calculate_rule_based_score, get_risk_level

class RiskModel:
    def __init__(self):
        # In-memory event accumulator per session
        self._session_events = defaultdict(lambda: defaultdict(int))

    def add_event(self, session_id: str, event_type: str):
        """Record an event for a session."""
        self._session_events[session_id][event_type] += 1

    def get_score(self, session_id: str) -> dict:
        """Calculate current risk score for a session."""
        event_counts = dict(self._session_events.get(session_id, {}))
        
        score, reasons = calculate_rule_based_score(event_counts)
        risk_level = get_risk_level(score)

        return {
            "session_id": session_id,
            "risk_score": score,
            "risk_level": risk_level,
            "reasons": reasons,
            "event_counts": event_counts
        }

    def clear_session(self, session_id: str):
        """Clear accumulated events for a session."""
        if session_id in self._session_events:
            del self._session_events[session_id]


# Singleton
risk_model = RiskModel()
