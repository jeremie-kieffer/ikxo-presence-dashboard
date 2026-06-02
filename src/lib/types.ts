// Types côté parser : donnée brute uniquement.
// Les agrégats (total de présences, statut OKR, régularité, etc.) sont
// dérivés par les calculateurs dans kpi-calculators.ts.

export type CelluleSaisie = 1 | "IC" | "M" | null

export type StatutOKR = "atteint" | "sous_objectif" | "absence_longue"

// 'interne' = membre du cabinet hors mission (ex. fondateur Jérémie Kieffer) :
// jamais saisi dans les onglets de présence. 'consultant' = effectif suivi par
// l'OKR. Défaut 'consultant' quand la colonne Rôle du Référentiel est vide.
export type RoleConsultant = "consultant" | "interne"

export interface Consultant {
  nom: string
  dateEntree: Date | null
  dateSortie: Date | null
  role: RoleConsultant
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
  formations: SessionFormation[]
  // Map consultant -> Map idSession -> rôle ('F' formateur, 'P' participant)
  participationsFormations: ParticipationsFormation
  feedbacksFormation: FeedbackFormation[]
}

// === Formations ===

export type RoleFormation = "F" | "P"

export interface SessionFormation {
  idSession: string // ex. 'F-2026-001'
  date: Date
  thematique: string
  formateurs: string[] // co-animation possible : split par virgule du champ Excel
  lienSupport?: string
}

// Map<nomConsultant, Map<idSession, "F" | "P">>
// Choix Map plutôt qu'objet pour faciliter l'itération et préserver l'ordre.
export type ParticipationsFormation = Map<string, Map<string, RoleFormation>>

export interface FormationConsultant {
  nom: string
  participations: number // nb de "P"
  animations: number // nb de "F"
}

export interface FormationKPI {
  nbSessions: number
  nbParticipantsUniques: number // consultants ayant au moins une participation (P ou F)
  topFormateurs: { nom: string; nb: number }[] // tri desc, longueur ≤ 5
  topParticipants: { nom: string; nb: number }[] // tri desc, longueur ≤ 5
  parConsultant: FormationConsultant[]
}

// === Feedback Formation ===

export interface FeedbackFormation {
  idResponse: string
  idSession: string
  timestamp: Date
  noteGlobale: number // 1 à 5
  application: string // 4 valeurs : "Oui immédiatement" | "Oui mais j'ai besoin de plus de pratique" | "Pas sûr" | "Non"
  verbatimApprecie: string
  verbatimAmelioration: string
  verbatimCommentaire: string
}

export interface FeedbackKPIGlobal {
  nbFeedbacksTotal: number
  nbSessionsAvecFeedback: number
  noteMoyenneGlobale: number // ex. 4.2
  tauxRetourMoyen: number // ex. 0.78 (réponses / participants en moyenne)
  distribApplication: Record<string, number>
}

export interface FeedbackParSession {
  idSession: string
  nbRetours: number
  nbParticipants: number // count des F+P dans Formations_Participations pour cette session
  tauxRetour: number
  noteMoyenne: number | null
  distributionNotes: Record<number, number> // ex. {1: 0, 2: 1, 3: 0, 4: 4, 5: 3}
  feedbacks: FeedbackFormation[]
}
