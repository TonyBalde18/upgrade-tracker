/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { firebaseConfig } from './src/firebase.config'

/**
 * Strict Content-Security-Policy. GitHub Pages cannot send HTTP headers, so it is
 * injected as a <meta> tag. Only added to production builds: Vite's dev server
 * needs inline scripts and a websocket for hot reload.
 * Besides this site, only Google sign-in and the Firestore database are allowed.
 */
const authFrame = firebaseConfig.authDomain ? `https://${firebaseConfig.authDomain}` : "'none'"
const CSP = [
  "default-src 'self'",
  // Google sign-in loads its helper script from apis.google.com
  "script-src 'self' https://apis.google.com",
  // style attributes are used by the animation library and React Flow
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    'https://firestore.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://www.googleapis.com',
  ].join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  // the sign-in helper frame of your Firebase project
  `frame-src ${authFrame}`,
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
    // Largest files are loaded on demand only: Excel export (~850 kB, 250 kB compressed)
    // and the Firestore SDK (~440 kB). Both are single libraries that can not be split further.
    chunkSizeWarningLimit: 870,
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
          // Firebase: loaded on demand after the first screen is shown, in two parallel files
          if (
            /[\\/]node_modules[\\/](@firebase[\\/](firestore|webchannel-wrapper)|firebase[\\/]firestore)[\\/]/.test(
              id,
            )
          )
            return 'vendor-firestore'
          if (/[\\/]node_modules[\\/](firebase|@firebase|idb)[\\/]/.test(id))
            return 'vendor-firebase'
          // Excel export: downloaded the first time you export
          if (/[\\/]node_modules[\\/]exceljs[\\/]/.test(id)) return 'vendor-excel'
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
