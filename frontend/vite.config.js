import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import commonjsExternals from 'vite-plugin-commonjs-externals';
// import svgLoader from 'vite-svg-loader'
import EnvironmentPlugin from 'vite-plugin-environment';
import { webpackStats } from 'rollup-plugin-webpack-stats';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path from 'path';

// https://vitejs.dev/config/

const externals = ['path', /^src(\/.+)?$/];

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    EnvironmentPlugin({ DOUBLETAKE_HOST: null, DOUBLETAKE_PORT: 3000 }),
    // svgLoader(),
    commonjsExternals({
      externals,
    }),
    // Output webpack-stats.json file
    webpackStats(),

    VueI18nPlugin({
      include: [path.resolve(__dirname, './locales/**')],
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
