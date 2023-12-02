import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import commonjsExternals from 'vite-plugin-commonjs-externals';
// import svgLoader from 'vite-svg-loader'
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/

const path = require('path');

const externals = ['path', /^src(\/.+)?$/];

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
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
  },
}));
