// Types côté parser : donnée brute uniquement.
// Les agrégats (total de présences, statut OKR, régularité, etc.) sont
// dérivés par les calculateurs dans kpi-calculators.ts.

export type CelluleSaisie = 1 | "IC" | "M" | null

export type StatutOKR = "atteint" | "sous_objectif" | "absence_longue"

export interface Consultant {
  nom: string
  dateEntree?: Date
  dateSortie?: Date
}

export interface Evenement {
  date: Date
  type: string
  libelle: string
}

export interface PresenceJour {
  date: Date
  valeur: CelluleSaisie
}

export interface ConsultantMois {
  nom: string
  jours: PresenceJour[]
}

// Format 'YYYY-MM' (ex: '2026-04'). Utilisé comme clé de tri et de lookup.
export type MoisKey = string

export interface MoisData {
  cle: MoisKey
  annee: number
  mois: number // 1-12 (et non 0-11 comme Date.getMonth())
  joursOuvres: Date[]
  lignes: ConsultantMois[] // lignes de l'onglet Saisie YYYY-MM (peut différer du référentiel)
  evenementsDuMois: Evenement[]
}

export interface DashboardData {
  consultants: Consultant[] // référentiel maître (onglet Référentiel)
  evenements: Evenement[]
  mois: Record<MoisKey, MoisData>
  cles: MoisKey[] // mois triés croissant pour le sélecteur
}
