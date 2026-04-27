import type { StatutOKR } from "../lib/types"

const config: Record<StatutOKR, { libelle: string; classes: string }> = {
  atteint: {
    libelle: "Atteint",
    classes: "bg-emerald-100 text-emerald-800",
  },
  sous_objectif: {
    libelle: "Sous objectif",
    classes: "bg-amber-100 text-amber-800",
  },
  absence_longue: {
    libelle: "Absence longue",
    classes: "bg-slate-100 text-slate-600",
  },
}

export function StatutBadge({ statut }: { statut: StatutOKR }) {
  const c = config[statut]
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${c.classes}`}
    >
      {c.libelle}
    </span>
  )
}
