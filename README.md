# Dashboard de suivi de présence — IKXO

Dashboard web (Vite + React + TypeScript + Tailwind + Recharts) de suivi de l'OKR de présence des consultants IKXO, et de l'activité formation. Consultable par le Lead PM et les 2 co-fondateurs.

## Sources de données

- **Source de vérité (runtime)** : **Supabase** (Postgres managé, projet `noyaatbqkivzqxiwoded`). Le dashboard requête Supabase au chargement (`src/lib/supabase-fetchers.ts` → `fetchDashboardData()`, via le point d'entrée unique `src/lib/data-source.ts`). **Plus de parsing xlsx côté navigateur** depuis l'Étape 4.
- **Migration ponctuelle depuis Excel** : `scripts/migrate_xlsx_to_supabase.py` (Python + openpyxl) — recharge le xlsx dans Supabase quand on repart d'Excel.
- **Import de feedbacks Google Forms** : `scripts/import_feedbacks.py` — ajoute les CSV Google Forms dans le xlsx local (idempotent), avant migration.
- **Fixture de test** : `tests/fixtures/suivi_presence_consultants.xlsx` — ancien fichier source, désormais hors build prod, conservé pour valider les KPI dans les tests (voir CLAUDE.md § « Tests et fixtures »).

## Variables d'environnement

Requises pour que le front joigne Supabase (préfixe `VITE_` obligatoire) :

```
VITE_SUPABASE_URL=https://noyaatbqkivzqxiwoded.supabase.co
VITE_SUPABASE_ANON_KEY=<clé publishable / anon>
```

- **Dev** : dans un fichier `.env` à la racine (gitignoré).
- **Prod** : variables d'environnement Cloudflare Pages.

La clé `service_role` (script de migration Python) reste **serveur uniquement**, jamais dans le front.

## Commandes

```bash
npm run dev      # serveur de dev
npm run build    # typecheck + build de prod
npm test         # tests Vitest
```

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
