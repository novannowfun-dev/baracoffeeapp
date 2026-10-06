import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api-kasirpro': {
        target: 'https://api.kasirpro.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-kasirpro/, '')
      }
    }
  }
});
