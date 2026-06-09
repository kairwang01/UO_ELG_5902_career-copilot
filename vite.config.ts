import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            // Split heavy vendor libs into their own cacheable chunks so the main
            // app bundle stays smaller and these load in parallel / cache across deploys.
            manualChunks: {
              firebase: [
                'firebase/app',
                'firebase/auth',
                'firebase/firestore',
                'firebase/functions',
                'firebase/storage',
              ],
              pdf: ['pdfjs-dist'],
              charts: ['recharts'],
              docx: ['docx'],
              mammoth: ['mammoth'],
            },
          },
        },
      },
    };
});
