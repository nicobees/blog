import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  base: '/blog/',
  build: {
    cssCodeSplit: true,
    minify: 'terser',
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // TODO: check deprecation of assetInfo.name (should use names)
          const info = (assetInfo.name || '').split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          } else if (/woff|woff2|ttf|otf|eot/.test(ext)) {
            return `fonts/[name]-[hash][extname]`;
          } else if (ext === 'css') {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },
    target: 'esnext',
  },
  plugins: [
    react(),
    tailwindcss(),
    svgr({
      svgrOptions: { icon: true },
    }),
    //     {
    //       name: 'rewrite-css-links',
    //       transformIndexHtml(html) {
    //         const newValue = html.replace(
    //           /<link rel="stylesheet" crossorigin href="(.*?)">/g,
    //           (_m, href) => `
    // <link rel="preload" defer crossorigin href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">
    // <noscript><link defer crossorigin rel="stylesheet" href="${href}"></noscript>`,
    //         );
    //         return newValue;
    //       },
    //     },
  ],

  server: {
    open: false,
    port: 5173,
    strictPort: false,
  },
});
