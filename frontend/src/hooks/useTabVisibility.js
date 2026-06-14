import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useTabVisibility
 * Sekme değişimi ve tam ekran çıkışlarını takip eder.
 *
 * Çözdüğü problemler:
 * - Tam ekran ihlalinin 2 kez sayılması
 * - React StrictMode yüzünden aynı olayın çift tetiklenmesi
 * - Sınav bittikten sonra ihlal saymaya devam etmesi
 */

const FULLSCREEN_DUPLICATE_BLOCK_MS = 800;
const TAB_DUPLICATE_BLOCK_MS = 800;

const INITIAL_VIOLATIONS = {
  tabSwitch: 0,
  fullscreenExit: 0,
};

function getGlobalGuard() {
  if (!window.__PROCTORING_VISIBILITY_GUARD__) {
    window.__PROCTORING_VISIBILITY_GUARD__ = {
      lastFullscreenState: !!document.fullscreenElement,
      lastFullscreenExitAt: 0,
      lastTabSwitchAt: 0,
    };
  }

  return window.__PROCTORING_VISIBILITY_GUARD__;
}

export default function useTabVisibility(onViolation, isEnabled = true) {
  const [isTabVisible, setIsTabVisible] = useState(() => !document.hidden);

  const [isFullscreen, setIsFullscreen] = useState(
    () => !!document.fullscreenElement
  );

  const [violations, setViolations] = useState(INITIAL_VIOLATIONS);

  const violationsRef = useRef(INITIAL_VIOLATIONS);
  const onViolationRef = useRef(onViolation);
  const isEnabledRef = useRef(isEnabled);
  const fullscreenStartedRef = useRef(!!document.fullscreenElement);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  const emitViolation = useCallback((type, updatedViolations) => {
    if (!isEnabledRef.current) return;

    if (onViolationRef.current) {
      onViolationRef.current(type, updatedViolations);
    }
  }, []);

  const addViolation = useCallback(
    (type) => {
      if (!isEnabledRef.current) return;

      const current = violationsRef.current;

      const updated = {
        ...current,
        tabSwitch:
          type === "TAB_SWITCH"
            ? current.tabSwitch + 1
            : current.tabSwitch,
        fullscreenExit:
          type === "FULLSCREEN_EXIT"
            ? current.fullscreenExit + 1
            : current.fullscreenExit,
      };

      violationsRef.current = updated;
      setViolations(updated);
      emitViolation(type, updated);
    },
    [emitViolation]
  );

  const resetViolations = useCallback(() => {
    violationsRef.current = INITIAL_VIOLATIONS;
    setViolations(INITIAL_VIOLATIONS);

    const guard = getGlobalGuard();

    guard.lastFullscreenState = !!document.fullscreenElement;
    guard.lastFullscreenExitAt = 0;
    guard.lastTabSwitchAt = 0;

    fullscreenStartedRef.current = !!document.fullscreenElement;
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;

      setIsTabVisible(!hidden);

      if (!isEnabledRef.current) return;
      if (!hidden) return;

      const guard = getGlobalGuard();
      const now = Date.now();

      if (now - guard.lastTabSwitchAt < TAB_DUPLICATE_BLOCK_MS) {
        return;
      }

      guard.lastTabSwitchAt = now;
      addViolation("TAB_SWITCH");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [addViolation]);

  useEffect(() => {
    const guard = getGlobalGuard();

    const syncInitialFullscreenState = () => {
      const currentFullscreen = !!document.fullscreenElement;

      setIsFullscreen(currentFullscreen);
      guard.lastFullscreenState = currentFullscreen;

      if (currentFullscreen) {
        fullscreenStartedRef.current = true;
      }
    };

    const handleFullscreenChange = () => {
      const guard = getGlobalGuard();

      const currentFullscreen = !!document.fullscreenElement;
      const previousFullscreen = guard.lastFullscreenState;
      const now = Date.now();

      setIsFullscreen(currentFullscreen);
      guard.lastFullscreenState = currentFullscreen;

      if (currentFullscreen) {
        fullscreenStartedRef.current = true;
        return;
      }

      if (!isEnabledRef.current) return;
      if (!fullscreenStartedRef.current) return;

      // Sadece gerçek tam ekran -> tam ekran dışı geçişi ihlal say.
      if (previousFullscreen !== true || currentFullscreen !== false) {
        return;
      }

      // Aynı ESC / fullscreenchange olayı çift gelirse tek say.
      if (now - guard.lastFullscreenExitAt < FULLSCREEN_DUPLICATE_BLOCK_MS) {
        return;
      }

      guard.lastFullscreenExitAt = now;
      addViolation("FULLSCREEN_EXIT");
    };

    syncInitialFullscreenState();

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [addViolation]);

  const requestFullscreen = useCallback(async () => {
    try {
      const element = document.documentElement;
      const guard = getGlobalGuard();

      if (document.fullscreenElement) {
        setIsFullscreen(true);
        fullscreenStartedRef.current = true;
        guard.lastFullscreenState = true;
        return true;
      }

      if (!element.requestFullscreen) {
        console.warn("[useTabVisibility] Tarayıcı tam ekran API desteklemiyor.");
        return false;
      }

      await element.requestFullscreen();

      setIsFullscreen(true);
      fullscreenStartedRef.current = true;
      guard.lastFullscreenState = true;

      return true;
    } catch (err) {
      console.warn("[useTabVisibility] Tam ekran açılamadı:", err.message);
      return false;
    }
  }, []);

  return {
    isTabVisible,
    isFullscreen,
    violations,
    requestFullscreen,
    resetViolations,
  };
}