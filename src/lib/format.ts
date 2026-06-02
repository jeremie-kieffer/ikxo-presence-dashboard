// Formate un nombre décimal en français : virgule décimale.
// Ex : formatFr(3.14) → "3,1" ; formatFr(2.65, 2) → "2,65".
export function formatFr(n: number, decimales = 1): string {
  return n.toFixed(decimales).replace(".", ",")
}

// Formate une date en JJ/MM (sans année, pour usage compact).
export function formatDateCourte(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`
}

// Libellé de fraîcheur des données affiché dans la sidebar.
// Retourne null si la date est absente (pas de placeholder bancal).
// Ex : libelleMiseAJour(new Date('2026-06-02')) → "Données à jour au 2 juin 2026".
export function libelleMiseAJour(d: Date | null): string | null {
  if (!d) return null
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
  return `Données à jour au ${date}`
}
