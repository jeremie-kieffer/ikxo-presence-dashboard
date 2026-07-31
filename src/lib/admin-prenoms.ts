// Mapping des prénoms d'admins IKXO avec l'orthographe correcte
// (accents, casse). Les admins non listés ici ont un affichage
// automatique depuis leur email.
export const PRENOMS_ADMINS: Record<string, string> = {
  "jeremie.kieffer@ikxo.fr": "Jérémie",
  // Ajouter ici les autres admins au fil de l'eau
}

export function prenomAdmin(email: string): string {
  if (PRENOMS_ADMINS[email]) return PRENOMS_ADMINS[email]
  const local = email.split("@")[0] ?? ""
  const prenom = local.split(".")[0] ?? ""
  if (prenom === "") return email
  return prenom.charAt(0).toUpperCase() + prenom.slice(1)
}
