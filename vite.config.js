import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Los plugins de Capacitor solo existen dentro de la aplicación de Android.
// En el portal web nunca se cargan, porque nativo.js los importa detrás de una
// comprobación. Se marcan como externos para que la compilación de Vercel no
// falle buscando librerías que ahí no hacen falta.
const NATIVOS = [
  '@capacitor/status-bar',
  '@capacitor/splash-screen',
  '@capacitor/app',
  '@capacitor/keyboard',
  '@capacitor/push-notifications',
]

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: NATIVOS,
      output: {
        // Sin esto, el navegador intentaría descargarlos y daría error 404.
        paths: Object.fromEntries(NATIVOS.map(n => [n, '/capacitor-vacio.js'])),
      },
    },
  },
})
