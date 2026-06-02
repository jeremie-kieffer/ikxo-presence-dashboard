import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Date de dernier build, évaluée une seule fois à la compilation. Avance à
  // chaque build/déploiement Cloudflare (donc à chaque push), figée entre
  // deux. Remplace la lecture du header Last-Modified, que Cloudflare Pages
  // ne sert pas pour les fichiers statiques.
  define: {
    __DATE_MISE_A_JOUR__: JSON.stringify(new Date().toISOString()),
  },
})
