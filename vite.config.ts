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
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
