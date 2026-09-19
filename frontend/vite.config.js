import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    // Defaults to the backend's own default port; override with API_PROXY when
    // running the API somewhere else (e.g. a second checkout on another port).
    proxy: {
      '/api': process.env.API_PROXY || 'http://localhost:4010',
    },
  },
});
