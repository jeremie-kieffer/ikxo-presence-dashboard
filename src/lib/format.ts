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
