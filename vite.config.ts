/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * Strict Content-Security-Policy. GitHub Pages cannot send HTTP headers, so it is
 * injected as a <meta> tag. Only added to production builds: Vite's dev server
 * needs inline scripts and a websocket for hot reload.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // style attributes are used by the animation library and React Flow
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        /<!-- %CSP%[^>]*-->/,
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

// GitHub Pages serves the app from https://<owner>.github.io/upgrade-tracker/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/upgrade-tracker/' : '/',
  plugins: [react(), tailwindcss(), cspPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      onwarn(warning, warn) {
        // zod ships comments rollup cannot place; harmless
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('zod')) return
        warn(warning)
      },
      output: {
        // Libraries in their own long-cached files: an app update only re-downloads app code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id))
            return 'vendor-react'
          if (/[\\/]node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(id))
            return 'vendor-motion'
          if (/[\\/]node_modules[\\/](@xyflow|d3-[^\\/]+|classcat)[\\/]/.test(id))
            return 'vendor-flow'
          if (/[\\/]node_modules[\\/](zod|immer|zustand|zundo|date-fns|date-fns-tz)[\\/]/.test(id))
            return 'vendor-data'
          // used only by lazily loaded pages: leave them with those pages
          if (/[\\/]node_modules[\\/](@fontsource-variable|@dnd-kit|@tanstack)[\\/]/.test(id))
            return undefined
          return 'vendor-ui'
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
