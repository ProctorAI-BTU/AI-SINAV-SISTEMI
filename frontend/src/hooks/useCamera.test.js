import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'

import useCamera from './useCamera'

describe('useCamera Hook', () => {

  let mockStream
  let mockTrack

  beforeEach(() => {

    mockTrack = {
      stop: vi.fn(),
    }

    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    }

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn(),
    }

    vi.clearAllMocks()
  })

  test('başlangıç state değerleri doğru olmalı', () => {
    const { result } = renderHook(() => useCamera())

    expect(result.current.isActive).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.stream).toBe(null)
  })

  test('startCamera başarılı şekilde stream döndürmeli', async () => {

    navigator.mediaDevices.getUserMedia.mockResolvedValue(
      mockStream
    )

    const { result } = renderHook(() => useCamera())

    let returnedStream

    await act(async () => {
      returnedStream =
        await result.current.startCamera()
    })

    expect(returnedStream).toBe(mockStream)

    expect(result.current.isActive).toBe(true)

    expect(result.current.error).toBe(null)

    expect(result.current.stream).toBe(mockStream)
  })

  test('getUserMedia doğru parametrelerle çağrılmalı', async () => {

    navigator.mediaDevices.getUserMedia.mockResolvedValue(
      mockStream
    )

    const { result } = renderHook(() => useCamera())

    await act(async () => {
      await result.current.startCamera()
    })

    expect(
      navigator.mediaDevices.getUserMedia
    ).toHaveBeenCalledWith({
      video: {
        width: 640,
        height: 480,
        facingMode: 'user',
      },
      audio: true,
    })
  })

  test('videoRef varsa stream video elementine bağlanmalı', async () => {

    navigator.mediaDevices.getUserMedia.mockResolvedValue(
      mockStream
    )

    const { result } = renderHook(() => useCamera())

    const mockPlay = vi.fn(() => Promise.resolve())

    result.current.videoRef.current = {
      srcObject: null,
      play: mockPlay,
    }

    await act(async () => {
      await result.current.startCamera()
    })

    expect(
      result.current.videoRef.current.srcObject
    ).toBe(mockStream)

    expect(mockPlay).toHaveBeenCalled()
  })

  test('kamera erişim hatasında error set edilmeli', async () => {

    navigator.mediaDevices.getUserMedia.mockRejectedValue(
      new Error('Permission denied')
    )

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const { result } = renderHook(() => useCamera())

    let returnedValue

    await act(async () => {
      returnedValue =
        await result.current.startCamera()
    })

    expect(returnedValue).toBe(null)

    expect(result.current.isActive).toBe(false)

    expect(result.current.error).toBe(
      'Permission denied'
    )

    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  test('stopCamera trackleri durdurmalı', async () => {

    navigator.mediaDevices.getUserMedia.mockResolvedValue(
      mockStream
    )

    const { result } = renderHook(() => useCamera())

    await act(async () => {
      await result.current.startCamera()
    })

    act(() => {
      result.current.stopCamera()
    })

    expect(mockTrack.stop).toHaveBeenCalled()
  })

  test('stopCamera video srcObject temizlemeli', async () => {

    navigator.mediaDevices.getUserMedia.mockResolvedValue(
      mockStream
    )

    const { result } = renderHook(() => useCamera())

    result.current.videoRef.current = {
      srcObject: mockStream,
      play: vi.fn(),
    }

    await act(async () => {
      await result.current.startCamera()
    })

    act(() => {
      result.current.stopCamera()
    })

    expect(
      result.current.videoRef.current.srcObject
    ).toBe(null)
  })

  test('stopCamera sonrası isActive false olmalı', async () => {

    navigator.mediaDevices.getUserMedia.mockResolvedValue(
      mockStream
    )

    const { result } = renderHook(() => useCamera())

    await act(async () => {
      await result.current.startCamera()
    })

    expect(result.current.isActive).toBe(true)

    act(() => {
      result.current.stopCamera()
    })

    expect(result.current.isActive).toBe(false)
  })

  test('unmount olunca kamera otomatik kapanmalı', async () => {

    navigator.mediaDevices.getUserMedia.mockResolvedValue(
      mockStream
    )

    const { result, unmount } = renderHook(() =>
      useCamera()
    )

    await act(async () => {
      await result.current.startCamera()
    })

    unmount()

    expect(mockTrack.stop).toHaveBeenCalled()
  })

})