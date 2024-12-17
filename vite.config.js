"use strict";

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        { src: 'public/manifest.json', dest: '' },
        { src: 'public/icons/*', dest: 'icons' },
        { src: 'public/fonts/*', dest: 'fonts' }
      ]
    })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'background'
            ? 'background.js'
            : 'src/[name].js';
        }
      }
    },
    outDir: 'dist',
    assetsDir: 'src'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  }
});
