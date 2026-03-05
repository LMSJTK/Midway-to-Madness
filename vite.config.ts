import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // Proxy API requests to the Express backend
        '/api': {
          target: process.env.API_URL || 'http://backend:3001',
          changeOrigin: true,
          secure: false,
        },
        // Proxy generated image assets to the Express backend bypassing Vite's static cache
        '/assets': {
          target: process.env.API_URL || 'http://backend:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});