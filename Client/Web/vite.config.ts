import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import path from 'path'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-version',
      transformIndexHtml(html) {
        return html.replace(/%APP_VERSION%/g, packageJson.version)
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      'nl-pdf-wrapper': path.resolve(__dirname, './sub-modules/wasm-pdf-core/dist/js/main.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    port: 7190,
    proxy: {
      '/api': {
        target: 'http://localhost:8190',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8190',
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      // Allow serving files from sub-modules
      allow: [
        '.',
        path.resolve(__dirname, './sub-modules/wasm-pdf-core'),
      ],
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'pdfjs-dist'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('pdfjs-dist') || id.includes('pdf-lib')) {
            return 'pdf-vendor';
          }
          if (id.includes('wasm-pdf-core')) {
            return 'neolab-vendor';
          }
        },
      },
    },
  },
})
