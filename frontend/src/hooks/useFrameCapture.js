import { useCallback, useRef } from 'react';

/**
 * useFrameCapture — Video elementinden base64 frame yakalar
 * Canvas kullanarak video frame'i JPEG base64'e çevirir
 */
export default function useFrameCapture(videoRef) {
  const canvasRef = useRef(null);

  // canvas'ı lazy oluştur
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  /**
   * Mevcut video frame'ini base64 string olarak döndür
   * @param {number} quality - JPEG kalitesi (0-1), düşük = küçük boyut
   * @returns {string|null} base64 encoded JPEG (data:image/jpeg prefix'siz)
   */
  const captureFrame = useCallback((quality = 0.8) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null; // HAVE_CURRENT_DATA

    const canvas = getCanvas();
    let targetW = video.videoWidth || 640;
    let targetH = video.videoHeight || 480;

    // Performans Optimizasyonu (Kasmayı Önleme):
    // Yüksek çözünürlüklü (1080p vb.) kameralarda toDataURL işlemi ana thread'i çok yorar ve videoyu dondurur.
    // O yüzden görüntüyü backend'e atmadan önce Canvas üzerinde 640px genişliğe küçültüyoruz.
    const MAX_WIDTH = 640;
    if (targetW > MAX_WIDTH) {
      const ratio = MAX_WIDTH / targetW;
      targetW = MAX_WIDTH;
      targetH = Math.floor(targetH * ratio);
    }

    // Boyut değişmediyse resize etme — her atamada GPU texture sıfırlanır ve kamera kasmasına yol açar
    if (canvas.width !== targetW) canvas.width = targetW;
    if (canvas.height !== targetH) canvas.height = targetH;

    // willReadFrequently: true -> Tarayıcıya bu canvas'tan sürekli veri okuyacağımızı söyler.
    // Bu sayede donanım (GPU) ivmelendirmesi yerine yazılımsal (CPU) bellek kullanılır
    // ve GPU-CPU arası veri transferinden kaynaklanan video donmaları/kasmaları BİTER.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Performans Optimizasyonu (Kasmayı Önleme):
    // Senkron olan toDataURL yerine, işlemi arkaplan thread'ine atan toBlob ve FileReader kullanılıyor.
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);
    });
  }, [videoRef, getCanvas]);

  return { captureFrame };
}
