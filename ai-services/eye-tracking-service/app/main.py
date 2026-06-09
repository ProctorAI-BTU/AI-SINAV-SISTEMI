from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .schemas import GazeRequest, GazeResponse, HealthResponse
from .gaze_tracker import tracker

app = FastAPI(
    title="Eye Tracking Service",
    description="Göz takibi servisi - Öğrenci ekrana bakıyor mu kontrol eder",
    version="1.0.0"
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health", response_model=HealthResponse)
async def health():
    return {"service": "eye-tracking-service", "status": "healthy"}

@app.post("/track", response_model=GazeResponse)
async def track_gaze(request: GazeRequest):
    result = tracker.track(request.session_id, request.image_base64)
    return {"session_id": request.session_id, **result}
