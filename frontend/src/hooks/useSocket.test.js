import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'

import useSocket from './useSocket'

describe('useSocket Hook', () => {
  let mockSocket
  let originalWebSocket

  beforeEach(() => {
    originalWebSocket = global.WebSocket

    mockSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    }

    global.WebSocket = vi.fn(function () {
      return mockSocket
    })

    global.WebSocket.OPEN = 1

    vi.clearAllMocks()
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket
    vi.restoreAllMocks()
  })

  test('başlangıçta disconnected ve lastMessage null olmalı', () => {
    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    expect(result.current.isConnected).toBe(false)
    expect(result.current.lastMessage).toBe(null)
  })

  test('connect çağrılınca WebSocket oluşturmalı', () => {
    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    act(() => {
      result.current.connect()
    })

    expect(global.WebSocket).toHaveBeenCalledWith(
      'ws://localhost:3000'
    )
  })

  test('socket open olunca connected true olmalı ve onConnect çalışmalı', () => {
    const onConnect = vi.fn()

    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000', { onConnect })
    )

    act(() => {
      result.current.connect()
      mockSocket.onopen()
    })

    expect(result.current.isConnected).toBe(true)
    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  test('json mesaj gelince lastMessage güncellenmeli ve onMessage çalışmalı', () => {
    const onMessage = vi.fn()

    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000', { onMessage })
    )

    act(() => {
      result.current.connect()
      mockSocket.onmessage({
        data: JSON.stringify({ type: 'risk', score: 45 }),
      })
    })

    expect(result.current.lastMessage).toEqual({
      type: 'risk',
      score: 45,
    })

    expect(onMessage).toHaveBeenCalledWith({
      type: 'risk',
      score: 45,
    })
  })

  test('json olmayan mesaj gelirse raw message saklanmalı', () => {
    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    act(() => {
      result.current.connect()
      mockSocket.onmessage({
        data: 'plain-message',
      })
    })

    expect(result.current.lastMessage).toBe('plain-message')
  })

  test('send string mesaj göndermeli', () => {
    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    act(() => {
      result.current.connect()
      result.current.send('hello')
    })

    expect(mockSocket.send).toHaveBeenCalledWith('hello')
  })

  test('send object mesajı JSON string olarak göndermeli', () => {
    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    act(() => {
      result.current.connect()
      result.current.send({ type: 'ping' })
    })

    expect(mockSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ping' })
    )
  })

  test('socket open değilse send mesaj göndermemeli', () => {
    mockSocket.readyState = 0

    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    act(() => {
      result.current.connect()
      result.current.send('hello')
    })

    expect(mockSocket.send).not.toHaveBeenCalled()
  })

  test('disconnect socket close çağırmalı ve connected false olmalı', () => {
    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    act(() => {
      result.current.connect()
      mockSocket.onopen()
    })

    expect(result.current.isConnected).toBe(true)

    act(() => {
      result.current.disconnect()
    })

    expect(mockSocket.close).toHaveBeenCalledTimes(1)
    expect(result.current.isConnected).toBe(false)
  })

  test('socket close olunca connected false olmalı ve onDisconnect çalışmalı', () => {
    const onDisconnect = vi.fn()

    const { result } = renderHook(() =>
      useSocket('ws://localhost:3000', { onDisconnect })
    )

    act(() => {
      result.current.connect()
      mockSocket.onopen()
      mockSocket.onclose()
    })

    expect(result.current.isConnected).toBe(false)
    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  test('autoConnect true ise otomatik bağlanmalı', () => {
    renderHook(() =>
      useSocket('ws://localhost:3000', { autoConnect: true })
    )

    expect(global.WebSocket).toHaveBeenCalledWith(
      'ws://localhost:3000'
    )
  })

  test('unmount olunca disconnect çalışmalı', () => {
    const { result, unmount } = renderHook(() =>
      useSocket('ws://localhost:3000')
    )

    act(() => {
      result.current.connect()
      mockSocket.onopen()
    })

    unmount()

    expect(mockSocket.close).toHaveBeenCalledTimes(1)
  })
})