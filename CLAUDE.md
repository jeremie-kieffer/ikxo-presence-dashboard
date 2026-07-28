# Brief Claude Code — Dashboard de suivi de présence consultants

## Contexte du projet

Le cabinet IKXO (~30 personnes, dont 26 consultants en activité) suit un OKR : chaque consultant doit être présent au bureau **au moins 2 fois par mois**. Cible : 100% des consultants atteignent ce seuil.

Aujourd'hui le suivi se fait dans un fichier Excel maintenu manuellement par le Lead PM. L'objectif de ce projet est de créer un **dashboard web statique** qui :

- consomme les données de ce fichier Excel (en local, pas de backend)
- affiche les KPI cabinet et individuels selon 3 vues (mensuelle, hebdo, trimestrielle)
- est consultable par le Lead PM et les 2 co-fondateurs (3 utilisateurs max)
- n'est **pas** accessible aux consultants

## Stack technique recommandée

- **Framework** : Vite + React + TypeScript (rapide à initialiser, facile à maintenir, bonne expérience dev)
- **Styling** : Tailwind CSS (productivité maximale, design cohérent sans CSS custom)
- **Charts** : Recharts (simple, bien intégré React, suffisant pour les besoins)
- **Source de données (runtime)** : Supabase (Postgres managé, projet `noyaatbqkivzqxiwoded`). Le dashboard **requête Supabase** via `@supabase/supabase-js` (voir `src/lib/supabase-fetchers.ts` → `fetchDashboardData()`, exposé par `src/lib/data-source.ts`).
- **Lecture Excel** : SheetJS (`xlsx` package) — **plus utilisé au runtime** depuis l'Étape 4. Conservé uniquement pour le script de migration (`scripts/migrate_xlsx_to_supabase.py`, côté Python via openpyxl) et comme lecteur de la fixture de test (`src/lib/excel-parser.ts`).
- **Hébergement** : Cloudflare Pages (redéploiement à chaque push sur `main`).

> **Historique** : jusqu'à l'Étape 4, le dashboard parsait le xlsx embarqué côté navigateur (pas de backend). Depuis, la source de vérité runtime est **Supabase** ; le xlsx n'est plus servi en prod (sorti de `public/` à la substep 4.6). Le paragraphe ci-dessous et la table des onglets décrivent le **format source Excel**, qui reste la porte d'entrée de la migration ponctuelle.

**Date de dernière mise à jour des données** (affichée dans la sidebar sous « Dashboard IKXO ») : depuis l'Étape 4.5, c'est le **`max(created_at)`** des tables Supabase, calculé par `dernierChangement()` dans `supabase-fetchers.ts` et exposé en `DashboardData.dateMiseAJour`. **Limite actuelle** : seules `consultants` et `presences` portent une colonne `created_at` ; la date reflète donc leur dernière insertion (aujourd'hui : la migration initiale du 04/06/2026) et **n'avance pas** encore sur un changement de formations / feedbacks / événements, ni sur un UPDATE in-place (voir « Dette technique »). L'ancien mécanisme `__DATE_MISE_A_JOUR__` injecté au build (Vite `define`) n'alimente plus cette date ; il reste utilisé uniquement par la fixture de test.

## Variables d'environnement

Le front lit deux variables (préfixe `VITE_` obligatoire pour être exposées au bundle) :
- `VITE_SUPABASE_URL` — URL du projet Supabase
- `VITE_SUPABASE_ANON_KEY` — clé *publishable* (anon), publique par nature, safe dans le bundle navigateur

En **dev** : fichier `.env` à la racine (gitignoré). En **prod** : variables d'environnement Cloudflare Pages. La clé `service_role` (utilisée par le script de migration Python) ne doit **jamais** être exposée au front.

## Tests et fixtures

Le fichier `tests/fixtures/suivi_presence_consultants.xlsx` est une **fixture historique** : plus servie en prod (déplacée hors de `public/` à la substep 4.6), elle alimente les tests Vitest qui valident les calculateurs KPI et feedback contre des valeurs de référence connues. `src/lib/excel-parser.ts` (+ la dépendance `xlsx`) sont conservés **uniquement** pour lire cette fixture dans : `excel-parser.test.ts`, `kpi-calculators.test.ts`, `kpi-feedback.test.ts`, `parser-feedback.test.ts`.

**Convention** : les assertions de ces tests sont une **photo de la vérité métier** à la date de la fixture ; elles sont mises à jour à chaque évolution majeure de la fixture (leur rôle est de détecter les régressions futures, pas de figer un passé). Dernière mise à jour : **28 juillet 2026** (+16 feedbacks → 63, +2 sessions → 20, +1 mois de saisie `2026-07`).

## Dette technique

- **`created_at` manquant sur 4 tables** (`sessions_formation`, `feedbacks_formation`, `participations_formation`, `evenements`) : à ajouter (**substep 4.7**) avant la mini-UI de saisie (substep 5), pour que la date de fraîcheur reflète tous les changements.
- **`updated_at` + triggers** : `created_at` ne bouge pas sur un UPDATE. Pour une vraie fraîcheur (édition in-place), prévoir une colonne `updated_at` alimentée par trigger — chantier DB séparé.

## Source de données

Le fichier source `suivi_presence_consultants.xlsx` contient les onglets suivants :

| Onglet | Rôle | Lecture par le dashboard |
|---|---|---|
| Convention | Documentation utilisateur | Non |
| Référentiel | Liste des consultants (actifs + ex), col A = nom, B = Date d'entrée, C = Date de sortie, D = Rôle (`interne` ou vide = `consultant`) | Oui (source consultants + détection d'incohérences) |
| Événements | Calendrier XO Days, séminaires | Oui (overlay sur graphiques) |
| Saisie YYYY-MM | Matrices de présence mensuelles | Oui (source principale) |
| Formations | Catalogue des sessions de formation (id_session, date, thématique, formateur, lien_support) | Oui (section Formation) |
| Formations_Participations | Matrice consultants × sessions ("F" = formateur, "P" = participant) | Oui (section Formation) |
| Formation_Feedbacks | Réponses Google Forms (8 colonnes : id_response, id_session, timestamp, note_globale, application, 3 verbatims) | Oui (drill-down par session) |
| Log | Format long auto-alimenté (squelette pour V2) | Non en V1 |
| Synthèse mensuelle | KPI mensuels calculés en Excel | Optionnel (recalcul possible côté JS) |
| Synthèse consultant | Vue consultant 3 mois | Optionnel |

**Règle d'or sur le Référentiel** : on ne supprime **jamais** une ligne consultant. Quand un consultant quitte le cabinet, on remplit sa Date de sortie. Ça permet au dashboard de continuer à interpréter correctement l'historique sans flag d'incohérence.

**Logique de l'alerte d'incohérences** (`detecterIncoherences` dans `kpi-calculators.ts`) : pour chaque mois saisi, on confronte les noms saisis au Référentiel.
- `saisi_hors_referentiel` : nom présent dans la Saisie mais absent du Référentiel (à corriger côté saisie).
- `absent_de_saisie` : consultant du Référentiel absent de la Saisie du mois — **mais uniquement s'il faisait partie de l'effectif suivi ce mois-là**. Un consultant n'est **pas** flagué si : (a) son `role` est `interne` (cas Jérémie Kieffer, fondateur hors mission), (b) sa `dateSortie` est antérieure au début du mois (déjà parti), ou (c) sa `dateEntree` est postérieure à la fin du mois (pas encore arrivé). Cette logique de cycle de vie évite les faux positifs sur les ex-consultants et les futurs entrants : bien remplir Rôle / Date d'entrée / Date de sortie au Référentiel suffit à faire disparaître les flags illégitimes.

**Convention de saisie dans les onglets `Saisie YYYY-MM`** :

| Symbole | Signification | Compte dans le total OKR |
|---|---|---|
| `1` | Présence normale | ✓ |
| `IC` | Présence pendant intercontrat | ✓ |
| `M` | Absence longue (mat/parental/maladie longue) | Consultant exclu du calcul du mois |
| `X` (sur ligne événement) | Date de l'événement | — |
| (vide) | Absence | ✗ |

**Structure d'un onglet `Saisie YYYY-MM`** :
- Ligne 1 : titre
- Ligne 3 : en-têtes (col A = "Consultant", col B+ = dates au format `DD-mois`, dernières colonnes = "Total" et "Statut OKR")
- Lignes 4 à 4+N : 1 ligne par consultant
- Lignes suivantes (après une ligne vide) : 3 lignes événements (`XO Day`, `XO Product Day`, `Séminaire`)

**Structure de l'onglet `Formations`** (catalogue) :
- Ligne 1 : titre
- Ligne 3 : en-têtes (`id_session`, `date`, `thématique`, `formateur`, `lien_support`)
- Lignes suivantes : 1 session par ligne, triées chronologiquement
- `id_session` au format `F-YYYY-NNN` (ex : `F-2026-007`)
- `formateur` : un ou plusieurs noms, séparés par virgule en cas de co-animation. Chaque nom doit exister au Référentiel (sinon un warn console est émis par le parser).

**Structure de l'onglet `Formations_Participations`** (matrice) :
- Ligne 1 : titre
- Ligne 3 : en-têtes (col A = "Consultant", col B = "Total" formule COUNTIF(F+P), col C+ = id_session)
- Lignes suivantes : 1 consultant par ligne
- Codes cellules : `F` (formateur, mise en forme conditionnelle bleue), `P` (participant, fond vert), vide (non concerné)

## KPI à afficher

### Vue mensuelle (vue par défaut, sélecteur de mois en haut)

**Cards KPI principaux (4)** :
1. **Taux d'atteinte OKR** : % consultants ≥2 jours / consultants actifs (= non absence longue). Affichage : pourcentage + delta vs M-1.
2. **Présence moyenne** : moyenne arithmétique des présences (en jours), sur les consultants actifs. Delta vs M-1.
3. **Consultants venus ≥1x** : nb / total actifs. Delta vs M-1.
4. **À surveiller** : nb consultants <2 jours, dont nb à 0 (jamais venus).

**Cards KPI secondaires (2)** :
5. **Pic du mois** : jour avec le plus de présences, avec badge de l'événement associé si applicable.
6. _(emplacement libre, à discuter)_

**Graphiques** :
- Distribution des présences (bar chart : 0, 1, 2, 3, 4, 5+ jours → nb consultants dans chaque tranche)
- Présence par jour de la semaine (bar chart : Lun-Ven → cumul des présences)

**Tableau détail consultant** :
- Nom, présences du mois, statut (Atteint / Sous objectif / N/A absence longue / Présence intercontrat), régularité sur 3 derniers mois
- Tri possible par colonne, signalement visuel des consultants "à risque" (3 mois consécutifs sous objectif)

### Vue hebdo

- Présence moyenne par consultant sur la semaine
- Pic de la semaine
- Bar chart des présences quotidiennes du mois en cours, avec marqueurs visuels sur les jours d'événement

### Vue trimestrielle

**Cards KPI (4)** :
1. Atteinte moyenne sur le trimestre
2. Régularité : % consultants à l'objectif tous les mois du trimestre
3. Pic du trimestre (avec événement)
4. Alertes récurrentes : nb consultants <2j sur tous les mois consécutifs

**Graphique** :
- Évolution mensuelle du taux d'atteinte (line chart) avec ligne de cible à 100%

### Section Formation

Section indépendante de la section Présence, accessible via le sélecteur Présence / Formation dans l'en-tête.

**Cards KPI (4)** :
1. **Sessions au catalogue** : nb total de sessions historiques (filtrable par date)
2. **Participants uniques** : nb consultants avec ≥1 P ou F sur la fenêtre
3. **Top formateur** : nom + nb d'animations
4. **Top participant** : nom + nb de participations

**Listes Top contributeurs** :
- Top 5 formateurs par nb d'animations
- Top 5 participants par nb de participations
- Tri desc par nb, départage alphabétique français

**Tableau des sessions** :
- Colonnes : date, thématique, formateur(s), nb de participants, lien support
- Tri : date ↓ (défaut), date ↑, nb participants ↓

**Vue par consultant** :
- Sélecteur consultant → liste de ses sessions (animées + participées), triées par date desc
- Compte rapide : N animation(s) · M participation(s)

### Module Feedback Formation

Couche additionnelle au-dessus du module Formation. La donnée vient d'un Google Form unique réutilisé pour chaque session (formulaire de retours envoyé après chaque atelier).

**Onglet Excel `Formation_Feedbacks`** — 8 colonnes :
- `id_response` (clé unique, ex. `r-001`)
- `id_session` (référence vers `Formations.id_session`)
- `timestamp` (date de la réponse)
- `note_globale` (entier 1-5)
- `application` (valeur d'une enum : « Oui immédiatement », « Oui mais j'ai besoin de plus de pratique », « Pas sûr », « Non »)
- `verbatim_apprecie` (texte libre — ce qui a marché)
- `verbatim_amelioration` (texte libre — axes d'amélioration)
- `verbatim_commentaire` (texte libre — autres retours, souvent vide)

**Alimentation** : script `scripts/import_feedbacks.py` (Python, dépend de `openpyxl`). Lit tous les CSV `imports_feedbacks/feedback_F-YYYY-NNN.csv` exportés depuis Google Forms et les ajoute à l'onglet, taggés avec l'id_session extrait du nom de fichier. **Idempotent** : la clé `(id_session, timestamp)` empêche les doublons à chaque relance.

**Affichage** (section Formation du dashboard) :
- 3 cards globaux : note moyenne sur 5 (couleur sémantique ≥4 vert / 3-3.9 bleu / <3 orange), taux de retour moyen (réponses ÷ participants, moyenne pondérée par session), barre stackée de la distribution `application`.
- Colonnes ajoutées au tableau des sessions : Note + Retours (ex. `8 / 10 (89 %)`).
- **Drill-down inline** : click sur une ligne ouvre un accordéon avec mini-histogramme des notes, barre Application sur cette session, et 3 blocs de verbatims regroupés par catégorie (« Ce qui a marché » sur fond vert pâle, « Axes d'amélioration » sur fond gris, « Autres retours » sur fond bleu pâle, ce dernier masqué si vide). Session sans feedback → message « Aucun retour collecté ».
- Top 5 formateurs enrichi : « Nom • N session(s) • X,X/5 » avec couleur de note.

**Seuils sémantiques** centralisés dans `src/lib/seuils-design.ts` : `SEUIL_NOTE_FORMATION_BONNE = 4`, `SEUIL_NOTE_FORMATION_PASSABLE = 3`.

## Règles de calcul à implémenter (importantes)

```typescript
// Comptage des présences
const compterPresences = (cellules: (string | number | null)[]): number => {
  return cellules.filter(c => c === 1 || c === '1' || c === 'IC').length;
};

// Statut OKR
const statutOKR = (cellules: (string | number | null)[]): 'atteint' | 'sous_objectif' | 'absence_longue' => {
  if (cellules.some(c => c === 'M')) return 'absence_longue';
  return compterPresences(cellules) >= 2 ? 'atteint' : 'sous_objectif';
};

// Taux d'atteinte du mois (sur consultants actifs uniquement)
const tauxAtteinte = (consultants: ConsultantMois[]): number => {
  const actifs = consultants.filter(c => c.statut !== 'absence_longue');
  if (actifs.length === 0) return 0;
  return actifs.filter(c => c.statut === 'atteint').length / actifs.length;
};
```

## Architecture de fichiers proposée

```
ikxo-presence-dashboard/
├── public/
│   └── data/
│       └── suivi_presence_consultants.xlsx  # fichier source embarqué
├── src/
│   ├── lib/
│   │   ├── excel-parser.ts    # lecture du fichier Excel via SheetJS (présence + formations)
│   │   ├── kpi-calculators.ts # fonctions de calcul présence + computeFormationKPIs
│   │   ├── format.ts          # helpers d'affichage (formatFr, formatDateCourte)
│   │   └── types.ts           # types TypeScript (Consultant, MoisData, SessionFormation, etc.)
│   ├── components/
│   │   ├── KPICard.tsx
│   │   ├── StatutBadge.tsx
│   │   ├── ConsultantTable.tsx
│   │   ├── views/
│   │   │   ├── MonthView.tsx
│   │   │   ├── QuarterView.tsx
│   │   │   └── FormationView.tsx
│   │   └── charts/
│   │       ├── DistributionChart.tsx
│   │       ├── DayOfWeekChart.tsx
│   │       └── MonthlyTrendChart.tsx
│   ├── App.tsx                # sélecteur Section (Présence / Formation) + Vue (Mensuelle / Trimestrielle)
│   └── main.tsx
├── tailwind.config.js
├── vite.config.ts
├── package.json
└── CLAUDE.md  # ce brief, à la racine du projet
```

## Charte visuelle

- **Style** : minimaliste, professionnel (le dashboard sera vu par les fondateurs)
- **Palette** :
  - Vert (#10b981) : objectif atteint
  - Orange (#f59e0b) : sous objectif
  - Rouge (#ef4444) : alerte 3 mois
  - Bleu (#3b82f6) : intercontrat
  - Violet (#8b5cf6) : événements
  - Gris : neutre
- **Typo** : Inter ou system-ui, pas de fioritures
- **Pas d'emojis** sauf indicateurs très ponctuels (✓, ⚠)
- **Responsive** : pas critique mais bien sur desktop avant tout (les fondateurs consultent sur ordinateur)

## Plan de travail suggéré pour la session Claude Code

1. **Setup** : initialiser le projet Vite + React + TS + Tailwind + Recharts + SheetJS
2. **Parser Excel** : écrire et tester `excel-parser.ts` qui lit le fichier et expose un objet `{ consultants, mois: { '2026-04': { ... } }, evenements }`
3. **Calculateurs KPI** : implémenter `kpi-calculators.ts` avec tests unitaires sur les chiffres connus (avril 2026 doit donner 77% d'atteinte, pic du 23/04 à 24)
4. **Vue mensuelle** : composant principal + cards + 2 graphiques + tableau
5. **Vue hebdo et trimestrielle** : déclinaisons
6. **Sélecteur de mois et navigation entre vues**
7. **Polish UI et déploiement** sur Vercel

## Données de validation (pour tester les calculs)

Pour vérifier que les calculs sont corrects, voici les valeurs attendues sur les mois disponibles :

> **Convention** : les valeurs de cette section sont mises à jour lors de chaque évolution majeure de la fixture. **Source de vérité exécutable : la suite `npm test`** (`tests/fixtures/suivi_presence_consultants.xlsx`). Dernière synchronisation : **28 juillet 2026**.

### Section Présence

Les valeurs de référence des KPI mensuels de présence (taux d'atteinte OKR, nb de consultants actifs, venus ≥1 fois, pic du mois) sont **ancrées dans `src/lib/kpi-presence.test.ts`**, bloc `Baseline KPI mensuels de présence` (un jeu de valeurs par mois de la fixture). **Source de vérité exécutable : `npm test`.** La table détaillée figée précédemment ici a été retirée car elle dérivait silencieusement à chaque mise à jour mensuelle du fichier ; la baseline de test échoue désormais si un KPI mensuel change sans mise à jour explicite.

### Section Formation (catalogue complet)

| KPI | Valeur attendue |
|---|---|
| Nb sessions | 20 |
| Nb participants uniques | 34 |
| Top formateur | Jérémie Kieffer (8 animations) |
| Top participant | Laureline Berthou (11 participations) |
| Jérémie Kieffer (référentiel) | 8 P + 8 F = 16 (cohérent avec la formule Total Excel) |
| Dernière session | F-2026-011 (Matthieu Le Corre, juillet 2026) |

### Section Feedback Formation

| KPI | Valeur attendue (fixture au 28/07/2026) |
|---|---|
| Nb feedbacks total | 63 |
| Nb sessions avec feedback | 9 (F-2026-003 → F-2026-011) |
| Note moyenne globale | ≈ 4,52 / 5 |
| Taux de retour moyen | ≈ 78 % |
| Distribution application | « Oui immédiatement » 35, « Oui mais besoin pratique » 16, « Pas sûr » 8, « Non » 4 |
| Théo Esposito (formateur) | 3 sessions avec feedback, note ≈ 4,43 |
| F-2026-009 (5 retours / 9 participants) | note 3,60 |
| F-2026-006 (7 retours / 5 participants, taux > 100 %) | note 4,86 |

**Cas particuliers à valider** :
- Zelal Aslan : marquée `M` en fév-mars (congé mat), `IC` en avril (11 IC). Doit être exclue du calcul fév-mars, comptée comme atteinte en avril.
- Julien Calvao : `IC` sur tous les mois (intercontrat permanent), 9-12 présences. Toujours atteint.
- Calixte Bailly : 1-0-1 sur fév-mars-avril. Doit apparaître en alerte "3 mois sous objectif".
- Nacim Souni : 11-0-1. Signal d'alerte (chute brutale, à investiguer).
- Agnes Bregeon : entrée 01/06/2026, désormais au Référentiel. Présente dans la Saisie de juin et non flaguée pour février→mai (règle (c), pas encore arrivée). Plus aucune incohérence la concernant.
- 6 ex-consultants (Anita Aladine, Camille Chansigaud, Emilien Rue, Gaetan Le Bail, Melchior R, Nicolas Renard) + Jérémie Kieffer (interne) : leur `Date de sortie` / `Rôle` étant désormais remplis, ils ne génèrent plus de flags. Anita Aladine, dont la sortie a été corrigée au 31/01/2026, n'était active sur aucun mois saisi → plus aucun flag. État du fichier au commit HEAD : l'alerte est passée de 36 flags à **0** (toute la donnée de cycle de vie est cohérente).

## Points d'attention pour le dev

1. **Lecture Excel robuste** : la structure des onglets `Saisie YYYY-MM` peut varier (nb de jours ouvrés différent par mois, position de la colonne "Total" qui change). Le parser doit s'adapter en se basant sur les en-têtes, pas sur des positions fixes.

2. **Format des dates** : les en-têtes Excel sont au format `DD-mois` (ex `01-avr`). SheetJS peut renvoyer des objets Date, des strings, ou des numéros de série Excel selon les cas. Tester et normaliser.

3. **Détection des lignes événements** : elles sont après une ligne vide après les consultants, identifiables par leur nom (`XO Day`, `XO Product Day`, `Séminaire`). À parser proprement.

4. **Gestion des consultants entrants/sortants** : Esther Mussot n'existe qu'à partir de mars. Le référentiel doit gérer ça via les colonnes `Date d'entrée` et `Date de sortie`.

5. **Performance** : pas un sujet à 26 consultants × 12 mois, mais bien structurer le code pour pouvoir scale si l'effectif double.

## Commandes utiles

```bash
# Initialisation
npm create vite@latest ikxo-presence-dashboard -- --template react-ts
cd ikxo-presence-dashboard
npm install
npm install xlsx recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Dev
npm run dev

# Build et preview
npm run build
npm run preview

# Déploiement Vercel (après installation de la CLI)
vercel
```

## Suggestions de prompts pour Claude Code

**Premier prompt après setup** :
> "Lis le fichier `public/data/suivi_presence_consultants.xlsx` et crée un parser TypeScript dans `src/lib/excel-parser.ts` qui extrait les données structurées selon les types qu'on aura définis dans `src/lib/types.ts`. Commence par les types puis le parser. Teste sur l'onglet `Saisie 2026-04` et affiche le résultat dans la console pour validation."

**Pour les calculs** :
> "Implémente dans `src/lib/kpi-calculators.ts` les fonctions de calcul des KPI mensuels (taux d'atteinte, moyenne, médiane, pic, etc.). Ajoute des tests unitaires avec Vitest qui vérifient les valeurs attendues d'avril 2026 (77% d'atteinte, pic du 23/04 à 24 présences)."

**Pour la vue mensuelle** :
> "Crée le composant `MonthView` qui affiche les KPI cards et les 2 graphiques (distribution + jour de la semaine) pour le mois sélectionné. Inspire-toi de la maquette qu'on a validée dans la conversation : 4 cards principales en grille, 2 cards secondaires en dessous, puis les graphiques côte à côte."

---

**Dernière chose** : ce brief est fait pour démarrer proprement, mais Claude Code va te poser des questions et te suggérer des choses. Sois en dialogue avec lui plutôt qu'en mode "exécute mon brief à la lettre" — c'est le bon réflexe à adopter et un super exercice pour ton coaching des consultants ensuite.
