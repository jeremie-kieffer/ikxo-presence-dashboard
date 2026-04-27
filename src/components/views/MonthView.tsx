import { formatFr } from "../../lib/format"
import {
  distributionPresences,
  moisPrecedent,
  nbActifs,
  nbJamaisVenus,
  nbSousObjectif,
  nbVenusAuMoinsUneFois,
  picDuMois,
  presenceMoyenne,
  presenceMoyenneParJourHorsIntercontrat,
  presenceMoyenneParJourTous,
  presenceParJourSemaine,
  tauxAtteinte,
} from "../../lib/kpi-calculators"
import type { DashboardData, MoisData } from "../../lib/types"
import { DayOfWeekChart } from "../charts/DayOfWeekChart"
import { DistributionChart } from "../charts/DistributionChart"
import { ConsultantTable } from "../ConsultantTable"
import { KPICard } from "../KPICard"

type Delta = { valeur: string; sens: "hausse" | "baisse" | "stable" }

export function MonthView({
  mois,
  data,
}: {
  mois: MoisData
  data: DashboardData
}) {
  const taux = tauxAtteinte(mois)
  const moyenne = presenceMoyenne(mois)
  const venus = nbVenusAuMoinsUneFois(mois)
  const actifs = nbActifs(mois)
  const sousObj = nbSousObjectif(mois)
  const jamais = nbJamaisVenus(mois)
  const pic = picDuMois(mois)
  const moyenneJourTous = presenceMoyenneParJourTous(mois)
  const moyenneJourHorsIC = presenceMoyenneParJourHorsIntercontrat(mois)

  const clePrec = moisPrecedent(data.cles, mois.cle)
  const moisPrec = clePrec ? data.mois[clePrec] : null
  const tauxPrec = moisPrec ? tauxAtteinte(moisPrec) : null
  const moyennePrec = moisPrec ? presenceMoyenne(moisPrec) : null
  const venusPrec = moisPrec ? nbVenusAuMoinsUneFois(moisPrec) : null

  const distribution = distributionPresences(mois)
  const parJourSemaine = presenceParJourSemaine(mois)

  const dateAffichage = `${pic.date.getDate()}/${(pic.date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`

  return (
    <div className="space-y-6">
      {/* Cards principales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titre="Taux d'atteinte OKR"
          valeur={`${Math.round(taux * 100)} %`}
          sousLibelle={`${actifs - sousObj} sur ${actifs} actifs`}
          delta={deltaPourcentagePoints(taux, tauxPrec)}
          accent={taux >= 0.8 ? "vert" : "orange"}
        />
        <KPICard
          titre="Présence moyenne par consultant"
          valeur={`${formatFr(moyenne)} j`}
          sousLibelle="Sur les consultants actifs (hors absences longues)"
          delta={deltaJours(moyenne, moyennePrec)}
          accent="bleu"
        />
        <KPICard
          titre="Consultants venus ≥1×"
          valeur={`${venus}/${actifs}`}
          sousLibelle={
            actifs > 0 ? `${Math.round((venus / actifs) * 100)} % des actifs` : ""
          }
          delta={deltaEntier(venus, venusPrec)}
          accent="bleu"
        />
        <KPICard
          titre="Consultants sous objectif"
          valeur={`${sousObj}`}
          sousLibelle={
            jamais > 0
              ? `Dont ${jamais} jamais venu${jamais > 1 ? "s" : ""} ce mois`
              : "Aucun à zéro présence"
          }
          accent={jamais > 0 ? "rouge" : "orange"}
        />
      </div>

      {/* Cards secondaires */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <KPICard
          titre="Pic du mois"
          valeur={`${pic.total}`}
          sousLibelle={
            pic.evenement
              ? `Le ${dateAffichage} — ${pic.evenement.type}`
              : `Le ${dateAffichage}`
          }
          accent={pic.evenement ? "violet" : "neutre"}
        />
        <KPICard
          titre="Présence moyenne par jour"
          valeur={
            <div className="flex flex-col gap-0.5 leading-tight">
              <div>
                {formatFr(moyenneJourTous)}{" "}
                <span className="text-base font-normal text-slate-500">
                  (tous)
                </span>
              </div>
              <div className="text-2xl">
                {formatFr(moyenneJourHorsIC)}{" "}
                <span className="text-base font-normal text-slate-500">
                  (hors intercontrat)
                </span>
              </div>
            </div>
          }
          sousLibelle={`Sur ${mois.joursOuvres.length} jours ouvrés`}
          accent="neutre"
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DistributionChart data={distribution} />
        <DayOfWeekChart data={parJourSemaine} />
      </div>

      {/* Tableau */}
      <ConsultantTable mois={mois} data={data} />
    </div>
  )
}

function deltaPourcentagePoints(
  actuel: number,
  prec: number | null,
): Delta | undefined {
  if (prec === null) return undefined
  const diff = (actuel - prec) * 100
  return {
    valeur: `${signe(diff)}${formatFr(diff)} pp`,
    sens: sens(diff, 0.1),
  }
}

function deltaJours(actuel: number, prec: number | null): Delta | undefined {
  if (prec === null) return undefined
  const diff = actuel - prec
  return {
    valeur: `${signe(diff)}${formatFr(diff)} j`,
    sens: sens(diff, 0.05),
  }
}

function deltaEntier(actuel: number, prec: number | null): Delta | undefined {
  if (prec === null) return undefined
  const diff = actuel - prec
  return {
    valeur: `${signe(diff)}${diff}`,
    sens: sens(diff, 0.5),
  }
}

function signe(n: number): string {
  return n > 0 ? "+" : ""
}

function sens(diff: number, seuil: number): Delta["sens"] {
  if (diff > seuil) return "hausse"
  if (diff < -seuil) return "baisse"
  return "stable"
}
