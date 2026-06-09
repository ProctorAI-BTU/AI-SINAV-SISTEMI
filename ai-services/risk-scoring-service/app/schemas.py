from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class EventInput(BaseModel):
    session_id: str
    event_type: str
    payload: Dict[str, Any] = {}
    risk_impact: float = 0.0
    timestamp: Optional[str] = None

class RiskScoreResponse(BaseModel):
    session_id: str
    risk_score: float
    risk_level: str
    reasons: List[str]
    event_counts: Dict[str, int]

class HealthResponse(BaseModel):
    service: str
    status: str
