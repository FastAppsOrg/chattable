import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'electron' ? [
      electron({
        main: {
          entry: 'electron/main.ts',
        },
        preload: {
          input: path.join(__dirname, 'electron/preload.ts'),
        },
        renderer: process.env.NODE_ENV === 'test' ? undefined : {},
      }),
    ] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@prd': path.resolve(__dirname, '../prd'),
    },
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      // 'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    watch: {
      // Ignore the .chattable directory where cloned projects are stored
      // This prevents Vite from detecting tsconfig changes and doing full reloads
      ignored: ['**/server/.chattable/**', '**/node_modules/**'],
    },
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: ['log', 'debug', 'warn'],
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
}))
