import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT ?? '5000';
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// RESA is deployed at the domain root on Cloudflare Pages and Netlify.
// Keep Vite assets and the client router on the same root path so an
// inherited BASE_PATH environment variable cannot break the public homepage.
const basePath = '/';

export default defineConfig({
  base: basePath,

  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),

    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },

  root: path.resolve(import.meta.dirname),

  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Keep frequently reused libraries in stable cacheable chunks. This
        // reduces repeat downloads when users move between school workspaces.
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('/node_modules/@tanstack/')) return 'vendor-query';
          if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) return 'vendor-charts';
          if (id.includes('/node_modules/lucide-react/') || id.includes('/node_modules/react-icons/')) return 'vendor-icons';
          if (id.includes('/node_modules/framer-motion/')) return 'vendor-motion';
          if (id.includes('/node_modules/date-fns/')) return 'vendor-dates';
          if (
            id.includes('/node_modules/@radix-ui/') ||
            id.includes('/node_modules/cmdk/') ||
            id.includes('/node_modules/vaul/') ||
            id.includes('/node_modules/embla-carousel') ||
            id.includes('/node_modules/react-day-picker/') ||
            id.includes('/node_modules/input-otp/') ||
            id.includes('/node_modules/sonner/')
          ) return 'vendor-ui';
          return undefined;
        },
      },
    },
  },

  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },

  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});