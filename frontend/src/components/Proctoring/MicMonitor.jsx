import React, { useEffect, useRef, useState } from 'react';
import proctoringService from '../../services/proctoring';

export default function MicMonitor({ stream, sessionId, isProctoringStarted, eventPayload = {} }) {
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const levelIntervalRef = useRef(null);

  useEffect(() => {
    if (!isProctoringStarted || !stream) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      // requestAnimationFrame yerine setInterval: 10fps görsel güncelleme yeterli,
      // bu sayede ana thread kamera frame çekimiyle yarışmıyor (kasma düzeltmesi)
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
        }
        setAudioLevel(sum / dataArrayRef.current.length);
      };
      levelIntervalRef.current = setInterval(updateLevel, 100);
    } catch (err) {
      console.error('AudioContext olusturulamadi:', err);
    }

    try {
      const bufferSize = 4096;
      const scriptNode = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(scriptNode);
      scriptNode.connect(audioContextRef.current.destination);

      let pcmChunks = [];
      let totalSamples = 0;
      
      scriptNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        pcmChunks.push(pcm16);
        totalSamples += pcm16.length;

        // 3 saniyelik buffer dolduğunda gönder
        if (totalSamples >= audioContextRef.current.sampleRate * 3) {
          // Chunk'ları birleştir (tek tek push yapmaktan 1000 kat daha hızlıdır)
          const mergedPcm = new Int16Array(totalSamples);
          let offset = 0;
          for (const chunk of pcmChunks) {
            mergedPcm.set(chunk, offset);
            offset += chunk.length;
          }

          const uint8 = new Uint8Array(mergedPcm.buffer);

          // FileReader kullanarak asenkron (ana thread'i hiç yormadan) base64'e çevir
          const blob = new Blob([uint8], { type: 'application/octet-stream' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            proctoringService
              .analyzeAudio(sessionId, base64data, audioContextRef.current.sampleRate, eventPayload)
              .catch((err) => {
                console.warn('Ses analizi gonderilemedi:', err);
              });
          };
          reader.readAsDataURL(blob);

          pcmChunks = [];
          totalSamples = 0;
        }
      };

      mediaRecorderRef.current = { stop: () => scriptNode.disconnect() };
    } catch (err) {
      console.error('PCM ses yakalayici baslatilamadi:', err);
    }

    return () => {
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
        levelIntervalRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.stop) {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [stream, isProctoringStarted, sessionId, eventPayload]);

  if (!isProctoringStarted) return null;

  const volumePercentage = Math.min(100, Math.round((audioLevel / 128) * 100));
  const barColor = volumePercentage > 70 ? '#ff4d4f' : volumePercentage > 30 ? '#faad14' : '#52c41a';

  return (
    <div style={{
      position: 'fixed',
      bottom: '220px',
      right: '20px',
      background: 'rgba(0,0,0,0.8)',
      padding: '10px 15px',
      borderRadius: '8px',
      zIndex: 1000,
      width: '240px',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxSizing: 'border-box'
    }}>
      <span style={{ fontSize: '18px' }}>Mic</span>
      <div style={{ flex: 1, background: '#333', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: `${volumePercentage}%`,
          background: barColor,
          height: '100%',
          transition: 'width 0.1s ease-out, background-color 0.3s ease'
        }} />
      </div>
    </div>
  );
}
