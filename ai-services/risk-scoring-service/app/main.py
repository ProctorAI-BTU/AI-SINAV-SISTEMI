from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .schemas import EventInput, RiskScoreResponse, HealthResponse
from .risk_model import risk_model

app = FastAPI(
    title="Risk Scoring Service",
    description="Risk skorlama servisi - Tüm eventleri toplayıp 0-100 arası risk skoru üretir",
    version="1.0.0"
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health", response_model=HealthResponse)
async def health():
    return {"service": "risk-scoring-service", "status": "healthy"}

@app.post("/analyze")
async def analyze_event(event: EventInput):
    """Receive an event and update the session's risk score."""
    risk_model.add_event(event.session_id, event.event_type)
    score_data = risk_model.get_score(event.session_id)
    return {"success": True, "data": score_data}

@app.get("/score/{session_id}", response_model=RiskScoreResponse)
async def get_risk_score(session_id: str):
    """Get current risk score for a session."""
    return risk_model.get_score(session_id)

@app.delete("/score/{session_id}")
async def clear_session(session_id: str):
    """Clear accumulated events for a session."""
    risk_model.clear_session(session_id)
    return {"success": True, "message": "Oturum verileri temizlendi."}
