# Dashboard de présence — IKXO

Dashboard interne IKXO de suivi des présences consultants et des sessions de formation. Multi-utilisateurs avec authentification par magic link, backed by Supabase.

## Aperçu produit

Outil utilisé par les ~7-8 admins d'IKXO (Lead PM, co-fondateurs) pour piloter deux sujets : l'**OKR de présence** — chaque consultant doit venir au bureau **≥ 2 jours par mois** — et l'**activité formation** (sessions animées, participations, feedbacks, ROI de la Team Formation). Il remplace le fichier Excel historique maintenu manuellement, en offrant une saisie et une consultation partagées, à jour en temps réel.

## Stack technique

- **Front** : React + TypeScript + Vite + Tailwind CSS v4 (charts : Recharts)
- **Backend** : Supabase (Postgres + Auth + REST API via `@supabase/supabase-js`)
- **Hosting** : Cloudflare Pages
- **Tests** : Vitest (112 tests)

## Architecture

```
Admin @ikxo.fr
  │  (magic link email)
  ▼
Cloudflare Pages  ──  React SPA (état-piloté, pas de router)
  │  (SDK Supabase, clé anon)
  ▼
Supabase Postgres
  6 tables : consultants · presences · evenements ·
             sessions_formation · participations_formation · feedbacks_formation
  ▲
  │  (clé service_role, ponctuel)
Scripts Python  ──  migration xlsx + import feedbacks (workflow historique)
```

- **Lecture** : la SPA requête Supabase avec la clé *anon* (publique). Point d'entrée unique : `src/lib/data-source.ts` → `fetchDashboardData()`.
- **Écriture** : réservée aux admins authentifiés (voir Sécurité).

## Fonctionnalités actuelles

- **Consultation** (sans authentification) :
  - Vue **Présence** (mensuelle / trimestrielle) — KPI OKR, distribution, pic du mois, détail par consultant.
  - Vue **Formation** — catalogue des sessions, top contributeurs, feedbacks.
- **Administration** (authentification Supabase requise) :
  - **Saisie des présences** — matrice mensuelle éditable (cycle vide / P / IC / M).
  - **Sessions formation** — création/édition d'une session, formateurs, participants, inscrits.
  - **Consultants** — référentiel : ajout, édition, marquage de sortie.

## Décisions produit importantes

- **Stockage des présences** : seuls les *faits positifs* sont en base (une ligne par présence réelle ; pas de ligne pour les absences). Le roster mensuel — qui est actif un mois donné — est **reconstitué à la lecture** depuis le référentiel via `estActifCeMois` (`src/lib/kpi-calculators.ts`).
- **Fixture de test** : `tests/fixtures/suivi_presence_consultants.xlsx` sert de fixture historique pour les tests KPI/feedback. Elle **n'est plus servie en prod** (sortie de `public/` à l'Étape 4).
- **Auth** : magic link email uniquement, restreint au domaine **@ikxo.fr** via un trigger PostgreSQL sur `auth.users`. Signup public désactivé (comptes provisionnés).
- **Sécurité** : **RLS** activée avec des policies séparées — lecture publique (`anon`), écriture réservée aux `authenticated`.
- **Suppression de session** : bloquée si la session a reçu des **feedbacks** (protection de l'historique).
- **Consultants** : pas de suppression — on **marque `date_sortie`** à la place. L'`email` est stocké en base mais **non éditable en Phase 1** (réservé à la Phase 2 : auth consultants).

## Développement local

```bash
git clone https://github.com/jeremie-kieffer/ikxo-presence-dashboard.git
cd ikxo-presence-dashboard
cp .env.example .env   # puis renseigner les valeurs
npm install
npm run dev
```

Variables d'environnement (`.env` à la racine, gitignoré) :

| Variable | Usage |
|---|---|
| `VITE_SUPABASE_URL` | Front — URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Front — clé anon/publishable (publique) |
| `SUPABASE_URL` | Scripts Python — URL du projet |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts Python — clé service_role (**serveur uniquement**) |

Les deux variables `VITE_` sont indispensables au front ; les deux autres ne servent qu'aux scripts de migration Python.

## Tests

```bash
npm test        # 112 tests (Vitest)
```

Convention : les tests sont la **source de vérité exécutable** des KPI. Leurs valeurs de référence sont mises à jour à chaque évolution majeure de la fixture (`tests/fixtures/suivi_presence_consultants.xlsx`).

## Déploiement

Push sur `main` → **Cloudflare Pages** rebuilde automatiquement (~90 s). Les variables d'environnement de prod sont configurées dans **Cloudflare Pages → Settings → Environment variables** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Scripts Python (workflow historique, en local)

Ancrés en local, utilisés ponctuellement tant que certaines données ne sont pas saisissables via l'UI :

- **`scripts/migrate_xlsx_to_supabase.py`** — migration ponctuelle du xlsx vers Supabase (nécessaire notamment pour les feedbacks, non saisissables via l'UI). Idempotent (upserts).
- **`scripts/import_feedbacks.py`** — import des CSV Google Forms dans le xlsx local (préalable avant migration).

Ces scripts requièrent `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` dans `.env` et `pip install supabase python-dotenv openpyxl`.

## Dette technique connue

- **Feedbacks** : import CSV uniquement via terminal local (chantier Phase 1.5 : bouton « Importer feedbacks » dans le drawer session).
- **Emails auth** : template et expéditeur par défaut Supabase (chantier Phase 2 : SMTP externe Resend + domaine @ikxo.fr).
- **Fraîcheur des données** : `dateMiseAJour` reflète uniquement les INSERT (`max(created_at)`), pas les UPDATE in-place (chantier futur : colonnes `updated_at` + triggers Postgres).
- **CI** : pas de GitHub Actions sur les PR (chantier futur : lancer `npm test` à chaque push).

## Contact / mainteneur

Jérémie Kieffer — Lead PM & co-fondateur IKXO.
Repo privé.
