from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .schemas import AudioRequest, AudioResponse, HealthResponse
from .audio_analyzer import analyzer

app = FastAPI(
    title="Audio Analysis Service",
    description="Ses analizi servisi - Ortamda konuşma/ses var mı kontrol eder",
    version="1.0.0"
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health", response_model=HealthResponse)
async def health():
    return {"service": "audio-analysis-service", "status": "healthy"}

@app.post("/analyze", response_model=AudioResponse)
async def analyze_audio(request: AudioRequest):
    result = analyzer.analyze(request.audio_base64, request.sample_rate)
    return {"session_id": request.session_id, **result}
