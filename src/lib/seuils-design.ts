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
