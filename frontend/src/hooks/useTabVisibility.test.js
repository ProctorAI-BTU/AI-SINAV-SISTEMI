import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'

import useTabVisibility from './useTabVisibility'

describe('useTabVisibility Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })

    document.documentElement.requestFullscreen = vi.fn(() =>
      Promise.resolve()
    )
  })

  test('başlangıç state değerleri doğru olmalı', () => {
    const { result } = renderHook(() =>
      useTabVisibility()
    )

    expect(result.current.isTabVisible).toBe(true)
    expect(result.current.isFullscreen).toBe(false)
    expect(result.current.violations).toEqual({
      tabSwitch: 0,
      fullscreenExit: 0,
    })
  })

  test('sekme gizlenince tabSwitch ihlali artmalı', () => {
    const onViolation = vi.fn()

    const { result } = renderHook(() =>
      useTabVisibility(onViolation)
    )

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    })

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.isTabVisible).toBe(false)
    expect(result.current.violations.tabSwitch).toBe(1)

    expect(onViolation).toHaveBeenCalledWith(
      'tab_switch',
      {
        tabSwitch: 1,
        fullscreenExit: 0,
      }
    )
  })

  test('sekme tekrar görünür olunca ihlal artmamalı', () => {
    const onViolation = vi.fn()

    const { result } = renderHook(() =>
      useTabVisibility(onViolation)
    )

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.isTabVisible).toBe(true)
    expect(result.current.violations.tabSwitch).toBe(0)
    expect(onViolation).not.toHaveBeenCalled()
  })

  test('requestFullscreen tam ekranı başlatmalı', async () => {
    const { result } = renderHook(() =>
      useTabVisibility()
    )

    await act(async () => {
      await result.current.requestFullscreen()
    })

    expect(document.documentElement.requestFullscreen)
      .toHaveBeenCalledTimes(1)

    expect(result.current.isFullscreen).toBe(true)
  })

  test('tam ekrandan çıkınca fullscreenExit ihlali artmalı', async () => {
    const onViolation = vi.fn()

    const { result } = renderHook(() =>
      useTabVisibility(onViolation)
    )

    await act(async () => {
      await result.current.requestFullscreen()
    })

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })

    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.isFullscreen).toBe(false)
    expect(result.current.violations.fullscreenExit).toBe(1)

    expect(onViolation).toHaveBeenCalledWith(
      'fullscreen_exit',
      {
        tabSwitch: 0,
        fullscreenExit: 1,
      }
    )
  })

  test('fullscreen hiç başlatılmadan fullscreenchange olursa ihlal sayılmamalı', () => {
    const onViolation = vi.fn()

    const { result } = renderHook(() =>
      useTabVisibility(onViolation)
    )

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })

    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.violations.fullscreenExit).toBe(0)
    expect(onViolation).not.toHaveBeenCalled()
  })

  test('requestFullscreen hata alırsa console.warn çalışmalı', async () => {
    const consoleSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    document.documentElement.requestFullscreen = vi.fn(() =>
      Promise.reject(new Error('Fullscreen blocked'))
    )

    const { result } = renderHook(() =>
      useTabVisibility()
    )

    await act(async () => {
      await result.current.requestFullscreen()
    })

    expect(consoleSpy).toHaveBeenCalled()
    expect(result.current.isFullscreen).toBe(false)

    consoleSpy.mockRestore()
  })
})