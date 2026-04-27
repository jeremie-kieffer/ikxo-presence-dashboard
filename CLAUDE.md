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
- **Lecture Excel** : SheetJS (`xlsx` package, lecture côté client du fichier .xlsx)
- **Hébergement** : Vercel ou Netlify (déploiement gratuit, lien partagé avec un mot de passe basique)

Pas de backend, pas de base de données. Tout est statique. L'utilisateur uploade le fichier Excel dans le navigateur, ou bien le fichier est versionné dans le repo et déployé avec.

**À discuter avec Claude Code** : le mode "upload manuel" vs "fichier embarqué dans le repo". Recommandation : fichier embarqué = plus simple, pas de friction à chaque consultation, mais nécessite un redéploiement à chaque mise à jour mensuelle (1 commande, automatisable).

## Source de données

Le fichier source `suivi_presence_consultants.xlsx` contient les onglets suivants :

| Onglet | Rôle | Lecture par le dashboard |
|---|---|---|
| Convention | Documentation utilisateur | Non |
| Référentiel | Liste des consultants actifs | Oui (filtrer les consultants à afficher) |
| Événements | Calendrier XO Days, séminaires | Oui (overlay sur graphiques) |
| Saisie YYYY-MM | Matrices de présence mensuelles | Oui (source principale) |
| Log | Format long auto-alimenté (squelette pour V2) | Non en V1 |
| Synthèse mensuelle | KPI mensuels calculés en Excel | Optionnel (recalcul possible côté JS) |
| Synthèse consultant | Vue consultant 3 mois | Optionnel |

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
│   │   ├── excel-parser.ts    # lecture du fichier Excel via SheetJS
│   │   ├── kpi-calculators.ts # toutes les fonctions de calcul
│   │   └── types.ts           # types TypeScript (Consultant, MoisData, Evenement, etc.)
│   ├── components/
│   │   ├── KPICard.tsx
│   │   ├── views/
│   │   │   ├── MonthView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   └── QuarterView.tsx
│   │   ├── charts/
│   │   │   ├── DistributionChart.tsx
│   │   │   ├── DayOfWeekChart.tsx
│   │   │   ├── DailyTrendChart.tsx
│   │   │   └── MonthlyTrendChart.tsx
│   │   └── ConsultantTable.tsx
│   ├── App.tsx
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

Pour vérifier que les calculs sont corrects, voici les valeurs attendues sur les 3 mois disponibles :

| Mois | Consultants actifs | Présences totales | Atteinte | Moyenne | Pic |
|---|---|---|---|---|---|
| Févr. 2026 | 25 | ~73 | 60% | 2,9 j | 19/02 (15) — XO Product Day |
| Mars 2026 | 26 | ~72 | 58% | 2,8 j | 26/03 (17) — XO Day |
| Avril 2026 | 26 | ~69 | 77% | 2,7 j | 23/04 (24) — XO Day |

**Cas particuliers à valider** :
- Zelal Aslan : marquée `M` en fév-mars (congé mat), `IC` en avril (8 présences). Doit être exclue du calcul fév-mars, comptée comme atteinte en avril.
- Julien Calvao : `IC` sur les 3 mois (intercontrat permanent), 9-12 présences. Toujours atteint.
- Calixte Bailly : 1-0-1 sur fév-mars-avril. Doit apparaître en alerte "3 mois sous objectif".
- Nacim Souni : 11-0-1. Signal d'alerte (chute brutale, à investiguer).

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
