import http from 'node:http';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Fresh TCP connection per request — avoids stale keep-alive sockets that the
// virtual-adapter forest on this Windows box silently kills, causing ETIMEDOUT
// on the first request after `yarn dev` starts.
const noKeepAlive = new http.Agent({ keepAlive: false });

// Use `localhost` rather than `127.0.0.1`: with WSL/Hyper-V/VirtualBox network
// adapters present, Node's connect to the literal IPv4 loopback can hang behind
// a delayed SYN/ACK, while DNS-resolved `localhost` takes a path that works.
const BACKEND = 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, agent: noKeepAlive },
      '/data': { target: BACKEND, changeOrigin: true, agent: noKeepAlive },
    },
  },
});