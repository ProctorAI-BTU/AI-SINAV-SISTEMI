from pydantic import BaseModel

class GazeRequest(BaseModel):
    session_id: str
    image_base64: str

class GazeResponse(BaseModel):
    session_id: str
    gaze: str  # "screen", "left", "right", "up", "down", "unknown"
    confidence: float
    duration_away_seconds: int
    event_type: str
    message: str

class HealthResponse(BaseModel):
    service: str
    status: str
