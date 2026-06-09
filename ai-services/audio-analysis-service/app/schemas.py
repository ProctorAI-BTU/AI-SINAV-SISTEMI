from pydantic import BaseModel

class AudioRequest(BaseModel):
    session_id: str
    audio_base64: str
    sample_rate: int = 16000

class AudioResponse(BaseModel):
    session_id: str
    audio_detected: bool
    avg_db: float
    peak_db: float
    duration_seconds: float
    event_type: str
    message: str

class HealthResponse(BaseModel):
    service: str
    status: str
