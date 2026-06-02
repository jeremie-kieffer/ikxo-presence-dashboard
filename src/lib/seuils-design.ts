// Seuils de coloration sémantique pour les KPI affichés. Conventions
// design IKXO : on encode le statut OKR dans la couleur du chiffre
// principal (≥80 % = atteint, 60-80 % = neutre, <60 % = sous objectif).
//
// Modifier ces seuils ICI uniquement. Toute vue qui colorise un taux
// passe par couleurTauxOKR() — on garde une source de vérité unique
// pour rester cohérent quand on ajoutera de nouveaux modules.

export const SEUIL_TAUX_OKR_ATTEINT = 0.8
export const SEUIL_TAUX_OKR_SOUS_OBJECTIF = 0.6

export type CouleurValeur = "vert" | "bleu" | "orange"

export function couleurTauxOKR(taux: number): CouleurValeur {
  if (taux >= SEUIL_TAUX_OKR_ATTEINT) return "vert"
  if (taux < SEUIL_TAUX_OKR_SOUS_OBJECTIF) return "orange"
  return "bleu"
}

// Note de feedback formation (échelle 1-5). Convention : ≥4 satisfaisant,
// 3-3.9 neutre, <3 alerte.
export const SEUIL_NOTE_FORMATION_BONNE = 4
export const SEUIL_NOTE_FORMATION_PASSABLE = 3

export function couleurNoteFormation(note: number): CouleurValeur {
  if (note >= SEUIL_NOTE_FORMATION_BONNE) return "vert"
  if (note < SEUIL_NOTE_FORMATION_PASSABLE) return "orange"
  return "bleu"
}
