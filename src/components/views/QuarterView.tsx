import {
  alertesRecurrentesTrimestre,
  clesDuTrimestre,
  consultantsReguliersTrimestre,
  evolutionTauxAtteinte,
  picTrimestre,
  tauxAtteinteTrimestre,
  trimestreDuMois,
} from "../../lib/kpi-calculators"
import type { DashboardData, MoisData } from "../../lib/types"
import { MonthlyTrendChart } from "../charts/MonthlyTrendChart"
import { KPICard } from "../KPICard"

export function QuarterView({
  mois,
  data,
}: {
  mois: MoisData
  data: DashboardData
}) {
  const tri = trimestreDuMois(mois.cle)
  const cles = clesDuTrimestre(data.cles, tri.annee, tri.numero)

  if (cles.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Aucune donnée disponible pour ce trimestre.
      </div>
    )
  }

  const taux = tauxAtteinteTrimestre(data, cles)
  const reguliers = consultantsReguliersTrimestre(data, cles)
  const pic = picTrimestre(data, cles)
  const alertes = alertesRecurrentesTrimestre(data, cles)
  const evolution = evolutionTauxAtteinte(data)

  const moisDispos = `${cles.length}/3 mois saisi${cles.length > 1 ? "s" : ""}`
  const sousTitre = `Q${tri.numero} ${tri.annee} — ${moisDispos}`
  const tauxOK = taux >= 0.8
  const tauxReguliers =
    reguliers.total > 0 ? reguliers.atteints / reguliers.total : 0

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-slate-800">{sousTitre}</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titre="Taux d'atteinte OKR — trimestre"
          valeur={`${Math.round(taux * 100)} %`}
          sousLibelle={`Moyenne des taux mensuels (${moisDispos})`}
          accent={tauxOK ? "vert" : "orange"}
        />
        <KPICard
          titre="Consultants réguliers"
          valeur={`${reguliers.atteints}/${reguliers.total}`}
          sousLibelle="Atteignent l'objectif chaque mois du trimestre"
          accent={tauxReguliers >= 0.8 ? "vert" : "orange"}
        />
        <KPICard
          titre="Pic du trimestre"
          valeur={`${pic.total}`}
          sousLibelle={
            pic.evenement
              ? `Le ${formatDate(pic.date)} — ${pic.evenement.type}`
              : `Le ${formatDate(pic.date)}`
          }
          accent={pic.evenement ? "violet" : "neutre"}
        />
        <KPICard
          titre="Consultants à risque"
          valeur={`${alertes.length}`}
          sousLibelle="Sous l'objectif sur tous les mois du trimestre"
          accent={alertes.length > 0 ? "rouge" : "vert"}
        />
      </div>

      <MonthlyTrendChart evolution={evolution} clesTrimestre={cles} />
    </div>
  )
}

function formatDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`
}
