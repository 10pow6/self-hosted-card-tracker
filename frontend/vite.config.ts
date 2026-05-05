import http from 'node:http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fresh TCP connection per request — avoids stale keep-alive sockets that the
// virtual-adapter forest on this Windows box silently kills, causing ETIMEDOUT
// on the first request after `yarn dev` starts.
const noKeepAlive = new http.Agent({ keepAlive: false });

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true, agent: noKeepAlive },
      '/data': { target: 'http://127.0.0.1:8000', changeOrigin: true, agent: noKeepAlive },
    },
  },
});
