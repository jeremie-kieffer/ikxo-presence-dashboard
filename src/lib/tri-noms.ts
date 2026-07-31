// Particules françaises et étrangères courantes détectées à la fin
// du prénom+nom pour un tri correct sur le vrai nom de famille.
const PARTICULES = new Set([
  // Français
  "le", "la", "les", "de", "du", "des", "d'",
  // Étrangers courants
  "van", "von", "der", "den", "di", "da", "dos", "al", "el", "bin",
])

export function nomDeFamille(nomComplet: string): string {
  const mots = nomComplet.trim().split(/\s+/).filter((m) => m.length > 0)
  if (mots.length === 0) return ""
  if (mots.length === 1) return mots[0]

  // On accumule depuis la fin les mots qui font partie du nom :
  // le dernier mot, plus toute particule qui le précède immédiatement.
  let debutNom = mots.length - 1
  while (debutNom > 0 && PARTICULES.has(mots[debutNom - 1].toLowerCase())) {
    debutNom--
  }
  return mots.slice(debutNom).join(" ")
}

export function comparerParNomFamille(a: string, b: string): number {
  return nomDeFamille(a).localeCompare(nomDeFamille(b), "fr", {
    sensitivity: "base",
  })
}
