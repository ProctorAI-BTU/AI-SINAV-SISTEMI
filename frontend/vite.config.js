import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    port: 5173,
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors *",
    },
    proxy: {
      // Auth Service (Node.js :3001)
      '/api/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/users': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },

      // AI Services (Python/FastAPI)
      '/ai/face': {
        target: 'http://127.0.0.1:8091',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai\/face/, ''),
      },
      '/ai/eye': {
        target: 'http://127.0.0.1:8092',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai\/eye/, ''),
      },
      '/ai/audio': {
        target: 'http://127.0.0.1:8093',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai\/audio/, ''),
      },
      '/ai/risk': {
        target: 'http://127.0.0.1:8094',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai\/risk/, ''),
      },

      // Exam Service (yarın gelecek — :3002)
      '/api/exams': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/api/sessions': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/api/proctoring': {
        target: 'http://127.0.0.1:3004',
        changeOrigin: true,
      },
      '/api/reports': {
        target: 'http://127.0.0.1:3003',
        changeOrigin: true,
      },
    },
  },
});
