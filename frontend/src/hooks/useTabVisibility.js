import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useTabVisibility — Sekme değişimi ve tam ekran ihlallerini takip eder
 * Sınav sırasında öğrencinin başka sekmeye geçtiğini veya tam ekrandan çıktığını algılar
 */
export default function useTabVisibility(onViolation) {
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violations, setViolations] = useState({ tabSwitch: 0, fullscreenExit: 0 });
  const onViolationRef = useRef(onViolation);
  const fullscreenStartedRef = useRef(false); // fullscreen en az 1 kez açıldı mı

  // callback referansını güncelle
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  // Sekme değişimi algılama
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsTabVisible(!hidden);

      if (hidden) {
        setViolations((prev) => {
          const updated = { ...prev, tabSwitch: prev.tabSwitch + 1 };
          if (onViolationRef.current) {
            onViolationRef.current('tab_switch', updated);
          }
          return updated;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Tam ekran değişimi algılama
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);

      // Tam ekrandan çıkıldığında ve daha önce en az 1 kez açıldıysa ihlal say
      if (!isFs && fullscreenStartedRef.current) {
        setViolations((prev) => {
          const updated = { ...prev, fullscreenExit: prev.fullscreenExit + 1 };
          if (onViolationRef.current) {
            onViolationRef.current('fullscreen_exit', updated);
          }
          return updated;
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Tam ekran modunu aç
  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      fullscreenStartedRef.current = true;
    } catch (err) {
      console.warn('[useTabVisibility] Tam ekran açılamadı:', err.message);
    }
  }, []);

  return {
    isTabVisible,
    isFullscreen,
    violations,
    requestFullscreen,
  };
}
