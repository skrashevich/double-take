import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import commonjsExternals from 'vite-plugin-commonjs-externals';
// import svgLoader from 'vite-svg-loader'

import { VitePWA } from 'vite-plugin-pwa';
import EnvironmentPlugin from 'vite-plugin-environment';
import { webpackStats } from 'rollup-plugin-webpack-stats';

// https://vitejs.dev/config/

const path = require('path');

const externals = ['path', /^src(\/.+)?$/];

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    EnvironmentPlugin({ DOUBLETAKE_HOST: null, DOUBLETAKE_PORT: 3000 }),
    // svgLoader(),
    commonjsExternals({
      externals,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Double Take',
        short_name: 'DoubleTake',
        theme_color: '#20262e',
        icons: [
          {
            src: 'src/assets/img/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },

          // other sizes as needed
        ],
      },
    }),
    // Output webpack-stats.json file
    webpackStats(),
  ],

  base: command === 'serve' ? '/' : './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Use a supported file pattern for Vite 5/Rollup 4
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
  },
}));
