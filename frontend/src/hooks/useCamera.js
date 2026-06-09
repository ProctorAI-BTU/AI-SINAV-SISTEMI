import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCamera — Webcam erişimi ve video stream yönetimi
 * Kamerayı açar, video elementine bağlar, hata durumlarını yönetir.
 */
export default function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setError(null);
      return stream;
    } catch (err) {
      console.error('[useCamera] Kamera erişim hatası:', err.message);
      setError(err.message);
      setIsActive(false);
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // Bileşen unmount olunca kamerayı kapat
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return { videoRef, isActive, error, startCamera, stopCamera, stream: streamRef.current };
}
