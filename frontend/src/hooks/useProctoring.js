import { useState, useEffect, useCallback, useRef } from 'react';
import useCamera from './useCamera.js';
import useFrameCapture from './useFrameCapture.js';
import useTabVisibility from './useTabVisibility.js';
import proctoringService from '../services/proctoring.js';

const ANALYSIS_INTERVAL_MS = 1000;

export default function useProctoring(sessionId, sessionMeta = {}) {
  const { videoRef, isActive: cameraActive, error: cameraError, startCamera, stopCamera, stream } = useCamera();
  const { captureFrame } = useFrameCapture(videoRef);

  const [faceResult, setFaceResult] = useState(null);
  const [gazeResult, setGazeResult] = useState(null);
  const [riskData, setRiskData] = useState({
    risk_score: 0,
    risk_level: 'LOW',
    reasons: [],
    event_counts: {},
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiHealth, setAiHealth] = useState([]);
  const [violationCount, setViolationCount] = useState(0);
  const [aiError, setAiError] = useState('Bekleniyor...');

  const isAnalyzingRef = useRef(false);
  const intervalRef = useRef(null);
  const sessionIdRef = useRef(sessionId);
  const sessionMetaRef = useRef(sessionMeta);
  const cameraActiveRef = useRef(cameraActive);

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { sessionMetaRef.current = sessionMeta; }, [sessionMeta]);
  useEffect(() => { cameraActiveRef.current = cameraActive; }, [cameraActive]);

  const buildEventPayload = useCallback((source, result = {}) => ({
    ...sessionMetaRef.current,
    source,
    message: result.message || '',
    result,
  }), []);

  const handleViolation = useCallback(async (type, violations) => {
    const total = violations.tabSwitch + violations.fullscreenExit;
    setViolationCount(total);

    try {
      const response = await proctoringService.sendEventSocket(
        sessionIdRef.current,
        type,
        buildEventPayload('browser', { violations })
      );

      if (response?.risk) {
        setRiskData(response.risk);
      }
    } catch (err) {
      console.warn('[useProctoring] Ihlal event kaydi basarisiz:', err.message);
    }
  }, [buildEventPayload]);

  const tabVisibility = useTabVisibility(handleViolation);

  const runAnalysis = useCallback(async () => {
    if (isAnalyzingRef.current) return;

    if (!sessionIdRef.current || !cameraActiveRef.current) {
      setAiError('Session veya kamera aktif degil');
      return;
    }

    const frame = await captureFrame(0.8);
    if (!frame) {
      setAiError('Kamera baglantisi bekleniyor');
      return;
    }

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setAiError('Analiz ediliyor...');

    try {
      const frameAnalysis = await proctoringService.analyzeFrameSocket(
        sessionIdRef.current,
        frame,
        buildEventPayload('frame')
      );

      const faceRes = frameAnalysis?.face;
      const gazeRes = frameAnalysis?.gaze;

      if (faceRes) {
        setFaceResult(faceRes);
      } else {
        setAiError('Yuz analizi alinamadi');
      }

      if (gazeRes) {
        setGazeResult(gazeRes);
      }

      if (frameAnalysis?.risk) {
        setRiskData(frameAnalysis.risk);
      } else {
        const score = await proctoringService.getRiskScore(sessionIdRef.current);
        if (score) setRiskData(score);
      }

      if (faceRes && gazeRes) setAiError('Basarili');
    } catch (err) {
      setAiError(`Analiz hatasi: ${err.message}`);
      console.warn('[useProctoring] Analiz hatasi:', err.message);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [buildEventPayload, captureFrame]);

  const startProctoring = useCallback(async (nextSessionId, nextSessionMeta) => {
    if (nextSessionId) {
      sessionIdRef.current = nextSessionId;
    }

    if (nextSessionMeta) {
      sessionMetaRef.current = nextSessionMeta;
    }

    const cameraStream = await startCamera();

    if (!cameraStream) {
      throw new Error('Kamera veya mikrofon izni alinamadi.');
    }

    if (sessionIdRef.current) {
      proctoringService.connectSocket(sessionIdRef.current);
    }

    const health = await proctoringService.checkHealth();
    setAiHealth(health);
    return cameraStream;
  }, [startCamera]);

  const stopProctoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    proctoringService.disconnectSocket();
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (cameraActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(runAnalysis, ANALYSIS_INTERVAL_MS);
      runAnalysis();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cameraActive, runAnalysis]);

  return {
    videoRef,
    cameraActive,
    cameraError,
    stream,
    faceResult,
    gazeResult,
    riskData,
    isAnalyzing,
    aiHealth,
    aiError,
    isTabVisible: tabVisibility.isTabVisible,
    isFullscreen: tabVisibility.isFullscreen,
    violations: tabVisibility.violations,
    violationCount,
    requestFullscreen: tabVisibility.requestFullscreen,
    startProctoring,
    stopProctoring,
  };
}
