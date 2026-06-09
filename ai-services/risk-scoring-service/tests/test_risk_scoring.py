import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.risk_model import RiskModel
from app.rule_based_score import calculate_rule_based_score, get_risk_level

client = TestClient(app)


class TestRuleBasedScore:
    def test_empty_events_are_low_risk(self):
        score, reasons = calculate_rule_based_score({})
        assert score == 0.0
        assert reasons == []
        assert get_risk_level(score) == "LOW"

    def test_agreed_weights_are_applied(self):
        score, reasons = calculate_rule_based_score(
            {
                "FACE_NOT_FOUND": 2,
                "GAZE_AWAY": 3,
                "AUDIO_DETECTED": 1,
            }
        )
        assert score == 62.0
        assert get_risk_level(score) == "MEDIUM"
        assert len(reasons) == 3

    def test_gaze_warning_has_small_score_impact(self):
        score, reasons = calculate_rule_based_score({"GAZE_WARNING": 3})
        assert score == 6.0
        assert get_risk_level(score) == "LOW"
        assert len(reasons) == 1

    def test_repeated_events_are_capped_per_type(self):
        score, reasons = calculate_rule_based_score(
            {
                "FACE_NOT_FOUND": 99,
                "GAZE_AWAY": 99,
            }
        )
        assert score == 84.0
        assert any("capped" in reason for reason in reasons)

    def test_total_score_is_capped_at_100(self):
        score, _ = calculate_rule_based_score(
            {
                "FACE_NOT_FOUND": 99,
                "MULTIPLE_FACE_DETECTED": 99,
                "GAZE_AWAY": 99,
                "AUDIO_DETECTED": 99,
                "FULLSCREEN_EXIT": 99,
            }
        )
        assert score == 100.0
        assert get_risk_level(score) == "CRITICAL"

    def test_unknown_events_are_ignored(self):
        score, reasons = calculate_rule_based_score({"SOMETHING_ELSE": 5})
        assert score == 0.0
        assert reasons == []


class TestRiskModel:
    def test_model_accumulates_events_per_session(self):
        model = RiskModel()
        model.add_event("session-1", "FACE_NOT_FOUND")
        model.add_event("session-1", "FACE_NOT_FOUND")
        model.add_event("session-1", "AUDIO_DETECTED")

        score = model.get_score("session-1")
        assert score["risk_score"] == 44.0
        assert score["risk_level"] == "LOW"
        assert score["event_counts"] == {
            "FACE_NOT_FOUND": 2,
            "AUDIO_DETECTED": 1,
        }

    def test_model_clear_session(self):
        model = RiskModel()
        model.add_event("session-1", "MULTIPLE_FACE_DETECTED")
        model.clear_session("session-1")

        score = model.get_score("session-1")
        assert score["risk_score"] == 0.0
        assert score["event_counts"] == {}


class TestAPI:
    def test_health_endpoint(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_analyze_and_score_flow(self):
        session_id = "api-risk-test"
        client.delete(f"/score/{session_id}")

        response = client.post(
            "/analyze",
            json={"session_id": session_id, "event_type": "MULTIPLE_FACE_DETECTED"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["risk_score"] == 20.0
        assert data["risk_level"] == "LOW"

        response = client.post(
            "/analyze",
            json={"session_id": session_id, "event_type": "FULLSCREEN_EXIT"},
        )
        assert response.status_code == 200

        response = client.get(f"/score/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["risk_score"] == 35.0
        assert data["event_counts"]["MULTIPLE_FACE_DETECTED"] == 1
        assert data["event_counts"]["FULLSCREEN_EXIT"] == 1
