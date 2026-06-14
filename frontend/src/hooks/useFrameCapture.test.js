import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'

import useFrameCapture from './useFrameCapture'

describe('useFrameCapture Hook', () => {
  let mockCanvas
  let mockContext
  let videoRef
  let originalCreateElement

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document)

    mockContext = {
      drawImage: vi.fn(),
    }

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toBlob: vi.fn((callback) => {
        callback(new Blob(['mock-image'], { type: 'image/jpeg' }))
      }),
    }

    vi.spyOn(document, 'createElement')
      .mockImplementation((tag) => {
        if (tag === 'canvas') {
          return mockCanvas
        }

        return originalCreateElement(tag)
      })

    global.FileReader = class {
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,MOCK_BASE64_DATA'
        this.onloadend()
      }
    }

    videoRef = {
      current: {
        readyState: 4,
        videoWidth: 1280,
        videoHeight: 720,
      },
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('captureFrame fonksiyonu tanımlı olmalı', () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    expect(result.current.captureFrame).toBeTypeOf('function')
  })

  test('video yoksa null dönmeli', async () => {
    const emptyRef = {
      current: null,
    }

    const { result } = renderHook(() =>
      useFrameCapture(emptyRef)
    )

    const frame = result.current.captureFrame()

    expect(frame).toBe(null)
  })

  test('video readyState yetersizse null dönmeli', async () => {
    const badVideoRef = {
      current: {
        readyState: 1,
      },
    }

    const { result } = renderHook(() =>
      useFrameCapture(badVideoRef)
    )

    const frame = result.current.captureFrame()

    expect(frame).toBe(null)
  })

  test('başarılı şekilde base64 frame döndürmeli', async () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    const frame = await result.current.captureFrame()

    expect(frame).toBe('MOCK_BASE64_DATA')
  })

  test('yüksek çözünürlükte canvas genişliği 640 olarak küçültülmeli', async () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    await result.current.captureFrame()

    expect(mockCanvas.width).toBe(640)
    expect(mockCanvas.height).toBe(360)
  })

  test('video boyutları yoksa varsayılan canvas boyutu kullanılmalı', async () => {
    const fallbackVideoRef = {
      current: {
        readyState: 4,
        videoWidth: 0,
        videoHeight: 0,
      },
    }

    const { result } = renderHook(() =>
      useFrameCapture(fallbackVideoRef)
    )

    await result.current.captureFrame()

    expect(mockCanvas.width).toBe(640)
    expect(mockCanvas.height).toBe(480)
  })

  test('drawImage çağrılmalı', async () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    await result.current.captureFrame()

    expect(mockContext.drawImage).toHaveBeenCalledWith(
      videoRef.current,
      0,
      0,
      640,
      360
    )
  })

  test('getContext willReadFrequently true ile çağrılmalı', async () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    await result.current.captureFrame()

    expect(mockCanvas.getContext).toHaveBeenCalledWith(
      '2d',
      { willReadFrequently: true }
    )
  })

  test('toBlob jpeg formatı ve quality değeri ile çağrılmalı', async () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    await result.current.captureFrame(0.5)

    expect(mockCanvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.5
    )
  })

  test('quality verilmezse varsayılan 0.8 kullanılmalı', async () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    await result.current.captureFrame()

    expect(mockCanvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.8
    )
  })

  test('toBlob null blob döndürürse null resolve etmeli', async () => {
    mockCanvas.toBlob.mockImplementationOnce((callback) => {
      callback(null)
    })

    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    const frame = await result.current.captureFrame()

    expect(frame).toBe(null)
  })

  test('canvas lazy şekilde yalnızca bir kez oluşturulmalı', async () => {
    const { result } = renderHook(() =>
      useFrameCapture(videoRef)
    )

    await result.current.captureFrame()
    await result.current.captureFrame()

    const canvasCreateCalls = document.createElement.mock.calls
      .filter(([tag]) => tag === 'canvas')

    expect(canvasCreateCalls).toHaveLength(1)
  })
})