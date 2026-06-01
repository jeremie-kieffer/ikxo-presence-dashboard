import type { StatutOKR } from "../lib/types"

// Couleurs pastel charte IKXO : background pâle + texte foncé du même ramp.
// Pas de bordure, font-medium, padding 3px / 10px, rounded-md.
const config: Record<StatutOKR, { libelle: string; classes: string }> = {
  atteint: {
    libelle: "Atteint",
    classes: "bg-[#E7F0EA] text-[#2C4530]",
  },
  sous_objectif: {
    libelle: "Sous objectif",
    classes: "bg-[#FFF1D1] text-[#7A5709]",
  },
  absence_longue: {
    libelle: "Absence longue",
    classes: "bg-[#EFEFEF] text-[#555555]",
  },
}

export function StatutBadge({ statut }: { statut: StatutOKR }) {
  const c = config[statut]
  return (
    <span
      className={`inline-flex items-center rounded-md px-[10px] py-[3px] text-xs font-medium ${c.classes}`}
    >
      {c.libelle}
    </span>
  )
}
