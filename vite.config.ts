import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// The Express asset server owns /assets in development. Vite's own bundle
// output would collide with that proxy, so it is emitted under /static instead.
const apiProxy = {
  target: process.env.API_URL || 'http://backend:3001',
  changeOrigin: true,
  secure: false,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    assetsDir: 'static',
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    proxy: {
      // Proxy API requests to the Express backend
      '/api': apiProxy,
      // Proxy generated image assets to the Express backend bypassing Vite's static cache
      '/assets': apiProxy,
    },
  },
  preview: {
    // A built site already carries its sprites, so only the editor API is
    // proxied here. Proxying /assets too would swallow the built bundle.
    proxy: {
      '/api': apiProxy,
    },
  },
});
