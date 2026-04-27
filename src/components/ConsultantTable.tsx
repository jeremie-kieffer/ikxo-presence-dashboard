import { useMemo, useState } from "react"
import {
  calculerStatutOKR,
  compterPresences,
  estARisque3Mois,
} from "../lib/kpi-calculators"
import type { DashboardData, MoisData, MoisKey, StatutOKR } from "../lib/types"
import { StatutBadge } from "./StatutBadge"

type TriColonne = "nom" | "presences" | "statut"
type TriOrdre = "asc" | "desc"

interface MoisHistorique {
  cle: MoisKey
  statut: StatutOKR
  presences: number
}

interface LigneEnrichie {
  nom: string
  presences: number
  statut: StatutOKR
  historique: MoisHistorique[]
  aRisque: boolean
}

export function ConsultantTable({
  mois,
  data,
}: {
  mois: MoisData
  data: DashboardData
}) {
  const [triPar, setTriPar] = useState<TriColonne>("nom")
  const [ordre, setOrdre] = useState<TriOrdre>("asc")

  const lignes = useMemo<LigneEnrichie[]>(() => {
    const idx = data.cles.indexOf(mois.cle)
    const debut = Math.max(0, idx - 2)
    const cles3 = data.cles.slice(debut, idx + 1)

    const enriched = mois.lignes.map<LigneEnrichie>((l) => {
      const presences = compterPresences(l.jours)
      const statut = calculerStatutOKR(l.jours)
      const historique: MoisHistorique[] = cles3.map((cle) => {
        const ligne = data.mois[cle]?.lignes.find((x) => x.nom === l.nom)
        if (!ligne) {
          return { cle, statut: "absence_longue", presences: 0 }
        }
        return {
          cle,
          statut: calculerStatutOKR(ligne.jours),
          presences: compterPresences(ligne.jours),
        }
      })
      const aRisque = estARisque3Mois(historique.map((h) => h.statut))
      return { nom: l.nom, presences, statut, historique, aRisque }
    })

    enriched.sort((a, b) => {
      let cmp = 0
      if (triPar === "nom") cmp = a.nom.localeCompare(b.nom, "fr")
      else if (triPar === "presences") cmp = a.presences - b.presences
      else cmp = a.statut.localeCompare(b.statut)
      return ordre === "asc" ? cmp : -cmp
    })

    return enriched
  }, [mois, data, triPar, ordre])

  const toggleTri = (col: TriColonne) => {
    if (triPar === col) {
      setOrdre(ordre === "asc" ? "desc" : "asc")
    } else {
      setTriPar(col)
      setOrdre("asc")
    }
  }

  const fleche = (col: TriColonne) =>
    triPar === col ? (ordre === "asc" ? "↑" : "↓") : ""

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            Détail par consultant
          </h3>
          <p className="text-xs text-slate-500">
            Tri possible par colonne. Les lignes en alerte (3 mois consécutifs
            sous objectif) sont surlignées.
          </p>
        </div>
        <LegendeRegularite />
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th
              className="cursor-pointer px-5 py-2.5 text-left hover:bg-slate-100"
              onClick={() => toggleTri("nom")}
            >
              Consultant {fleche("nom")}
            </th>
            <th
              className="cursor-pointer px-5 py-2.5 text-right hover:bg-slate-100"
              onClick={() => toggleTri("presences")}
            >
              Présences {fleche("presences")}
            </th>
            <th
              className="cursor-pointer px-5 py-2.5 text-left hover:bg-slate-100"
              onClick={() => toggleTri("statut")}
            >
              Statut {fleche("statut")}
            </th>
            <th className="px-5 py-2.5 text-left">Régularité 3 mois</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr
              key={l.nom}
              className={`border-t border-slate-100 ${l.aRisque ? "bg-red-50" : "hover:bg-slate-50"}`}
            >
              <td className="px-5 py-2.5 text-slate-900">
                {l.aRisque && (
                  <span
                    className="mr-1.5 text-red-600"
                    title="3 mois consécutifs sous objectif"
                  >
                    ⚠
                  </span>
                )}
                {l.nom}
              </td>
              <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                {l.presences}
              </td>
              <td className="px-5 py-2.5">
                <StatutBadge statut={l.statut} />
              </td>
              <td className="px-5 py-2.5">
                <RegulariteCell historique={l.historique} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MOIS_ABREV: Record<string, string> = {
  "01": "Janv.",
  "02": "Févr.",
  "03": "Mars",
  "04": "Avr.",
  "05": "Mai",
  "06": "Juin",
  "07": "Juill.",
  "08": "Août",
  "09": "Sept.",
  "10": "Oct.",
  "11": "Nov.",
  "12": "Déc.",
}

function LegendeRegularite() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span className="font-medium text-slate-600">Régularité 3 mois :</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        Atteint
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
        Sous objectif
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
        Absence longue
      </span>
    </div>
  )
}

function RegulariteCell({ historique }: { historique: MoisHistorique[] }) {
  const tooltip = historique.map(formatHistorique).join("  |  ")
  return (
    <div className="group relative inline-flex">
      <div className="flex gap-1.5">
        {historique.map((h) => (
          <span
            key={h.cle}
            className={`inline-block h-3 w-3 rounded-full ${
              h.statut === "atteint"
                ? "bg-emerald-500"
                : h.statut === "sous_objectif"
                  ? "bg-amber-500"
                  : "bg-slate-300"
            }`}
          />
        ))}
      </div>
      <div
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full right-0 z-50 mb-2 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100"
      >
        {tooltip}
        <span className="absolute right-3 top-full -mt-px h-2 w-2 -translate-y-1/2 rotate-45 bg-slate-900" />
      </div>
    </div>
  )
}

function formatHistorique(h: MoisHistorique): string {
  const m = h.cle.split("-")[1]
  const label =
    h.statut === "atteint"
      ? "Atteint"
      : h.statut === "sous_objectif"
        ? "Sous obj."
        : "Absence longue"
  return `${MOIS_ABREV[m]} : ${label} (${h.presences}j)`
}
