import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import useProctoring from './useProctoring'

import useCamera from './useCamera'
import useFrameCapture from './useFrameCapture'
import useTabVisibility from './useTabVisibility'
import proctoringService from '../services/proctoring'

vi.mock('./useCamera')
vi.mock('./useFrameCapture')
vi.mock('./useTabVisibility')
vi.mock('../services/proctoring')

describe('useProctoring Hook', () => {

  const mockVideoRef = {
    current: {},
  }

  const mockStream = {
    id: 'mock-stream',
  }

  beforeEach(() => {

    vi.useFakeTimers()

    useCamera.mockReturnValue({
      videoRef: mockVideoRef,
      isActive: true,
      error: null,
      startCamera: vi.fn(() => Promise.resolve(mockStream)),
      stopCamera: vi.fn(),
      stream: mockStream,
    })

    useFrameCapture.mockReturnValue({
      captureFrame: vi.fn(() =>
        Promise.resolve('mock-base64-frame')
      ),
    })

    useTabVisibility.mockReturnValue({
      isTabVisible: true,
      isFullscreen: true,
      violations: {
        tabSwitch: 0,
        fullscreenExit: 0,
      },
      requestFullscreen: vi.fn(),
    })

    proctoringService.connectSocket = vi.fn()

    proctoringService.disconnectSocket = vi.fn()

    proctoringService.checkHealth = vi.fn(() =>
      Promise.resolve([
        {
          name: 'face',
          online: true,
        },
      ])
    )

    proctoringService.analyzeFrameSocket = vi.fn(() =>
      Promise.resolve({
        face: {
          face_detected: true,
        },
        gaze: {
          gaze: 'screen',
        },
        risk: {
          risk_score: 15,
          risk_level: 'LOW',
          reasons: [],
          event_counts: {},
        },
      })
    )

    proctoringService.getRiskScore = vi.fn(() =>
      Promise.resolve({
        risk_score: 15,
        risk_level: 'LOW',
      })
    )

    proctoringService.sendEventSocket = vi.fn(() =>
      Promise.resolve({
        risk: {
          risk_score: 25,
          risk_level: 'MEDIUM',
        },
      })
    )

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('başlangıç state değerleri doğru olmalı', () => {

    const { result } = renderHook(() =>
      useProctoring('session-1')
    )

    expect(result.current.cameraActive).toBe(true)

    expect(result.current.cameraError).toBe(null)

    expect(result.current.faceResult).toBe(null)

    expect(result.current.gazeResult).toBe(null)

    expect(result.current.riskData.risk_score).toBe(0)

    expect(result.current.violationCount).toBe(0)
  })

  test('startProctoring kamerayı başlatmalı', async () => {

    const { result } = renderHook(() =>
      useProctoring('session-1')
    )

    let stream

    await act(async () => {
      stream =
        await result.current.startProctoring()
    })

    expect(stream).toBe(mockStream)
  })

  test('startProctoring socket bağlantısını başlatmalı', async () => {

    const { result } = renderHook(() =>
      useProctoring('session-1')
    )

    await act(async () => {
      await result.current.startProctoring()
    })

    expect(
      proctoringService.connectSocket
    ).toHaveBeenCalledWith('session-1')
  })

  test('AI health kontrolü yapılmalı', async () => {

    const { result } = renderHook(() =>
      useProctoring('session-1')
    )

    await act(async () => {
      await result.current.startProctoring()
    })

    expect(
      proctoringService.checkHealth
    ).toHaveBeenCalled()

    expect(result.current.aiHealth).toHaveLength(1)
  })

  test('analysis sonrası face, gaze ve risk data güncellenmeli', async () => {
  const { result } = renderHook(() =>
    useProctoring('session-1')
  )

  await act(async () => {
    await Promise.resolve()
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
  })

  expect(
    proctoringService.analyzeFrameSocket
  ).toHaveBeenCalled()

  expect(result.current.faceResult).toEqual({
    face_detected: true,
  })

  expect(result.current.gazeResult).toEqual({
    gaze: 'screen',
  })

  expect(result.current.riskData).toEqual({
    risk_score: 15,
    risk_level: 'LOW',
    reasons: [],
    event_counts: {},
  })
})

  test('analysis interval çalışmalı', async () => {

    renderHook(() =>
      useProctoring('session-1')
    )

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(
      proctoringService.analyzeFrameSocket
    ).toHaveBeenCalled()
  })

  test('stopProctoring socket bağlantısını kapatmalı', () => {

    const { result } = renderHook(() =>
      useProctoring('session-1')
    )

    act(() => {
      result.current.stopProctoring()
    })

    expect(
      proctoringService.disconnectSocket
    ).toHaveBeenCalled()
  })

})