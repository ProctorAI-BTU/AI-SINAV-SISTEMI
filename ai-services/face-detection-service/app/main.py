from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .schemas import FaceDetectionRequest, FaceDetectionResponse, HealthResponse
from .detector import detector

app = FastAPI(
    title="Face Detection Service",
    description="Yüz tespiti servisi - Kamerada yüz var mı, birden fazla yüz var mı kontrol eder",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/health", response_model=HealthResponse)
async def health():
    return {"service": "face-detection-service", "status": "healthy"}

@app.post("/detect", response_model=FaceDetectionResponse)
async def detect_face(request: FaceDetectionRequest):
    result = detector.detect(request.image_base64)
    return {
        "session_id": request.session_id,
        **result
    }
