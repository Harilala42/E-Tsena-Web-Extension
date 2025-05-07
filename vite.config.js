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
        background: resolve(__dirname, 'src/background.js'),
        content: resolve(__dirname, 'src/content-script/content.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background')
            return 'background.js';
          else if (chunkInfo.name === 'content')
            return 'content.js';
          else
            return 'src/[name].js';
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
