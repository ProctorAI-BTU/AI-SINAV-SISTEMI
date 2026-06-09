import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useSocket — WebSocket bağlantı yönetimi
 * Proctoring-service ile gerçek zamanlı iletişim için
 * (Proctoring-service implemente edildiğinde aktif olacak)
 * 
 * Şu an REST API üzerinden çalışıyoruz.
 * Socket.io eklendiğinde bu hook aktifleşecek.
 */
export default function useSocket(url, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const { onMessage, onConnect, onDisconnect, autoConnect = false } = options;

  const connect = useCallback(() => {
    if (wsRef.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (onConnect) onConnect();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (onMessage) onMessage(data);
        } catch {
          setLastMessage(event.data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (onDisconnect) onDisconnect();
      };

      ws.onerror = (err) => {
        console.warn('[useSocket] WebSocket hatası:', err);
      };
    } catch (err) {
      console.warn('[useSocket] Bağlantı kurulamadı:', err.message);
    }
  }, [url, onMessage, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { isConnected, lastMessage, connect, disconnect, send };
}
