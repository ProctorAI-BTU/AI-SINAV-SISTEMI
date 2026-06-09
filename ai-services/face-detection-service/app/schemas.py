from pydantic import BaseModel
from typing import Optional

class FaceDetectionRequest(BaseModel):
    session_id: str
    image_base64: str

class FaceDetectionResponse(BaseModel):
    session_id: str
    face_detected: bool
    multiple_faces: bool
    face_count: int
    confidence: float
    event_type: str
    message: str

class HealthResponse(BaseModel):
    service: str
    status: str
