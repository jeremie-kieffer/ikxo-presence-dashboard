import { useEffect, useMemo, useState } from "react"
import { MonthView } from "./components/views/MonthView"
import { QuarterView } from "./components/views/QuarterView"
import { chargerFichier } from "./lib/excel-parser"
import {
  clesDuTrimestre,
  detecterIncoherences,
  trimestreDuMois,
  type Incoherence,
} from "./lib/kpi-calculators"
import type { DashboardData, MoisKey } from "./lib/types"

type Vue = "mensuelle" | "trimestre"

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [moisSelectionne, setMoisSelectionne] = useState<MoisKey | null>(null)
  const [vue, setVue] = useState<Vue>("mensuelle")

  useEffect(() => {
    chargerFichier()
      .then((d) => {
        setData(d)
        if (d.cles.length > 0) {
          setMoisSelectionne(d.cles[d.cles.length - 1])
        }
      })
      .catch((e: Error) => setErreur(e.message))
  }, [])

  const trimestresDisponibles = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    for (const cle of data.cles) {
      const t = trimestreDuMois(cle)
      set.add(`${t.annee}-Q${t.numero}`)
    }
    return [...set].sort().reverse()
  }, [data])

  if (erreur) return <ErreurChargement message={erreur} />
  if (!data) return <Squelette />
  if (data.cles.length === 0) return <AucunMois />
  if (!moisSelectionne) return <Squelette />

  const mois = data.mois[moisSelectionne]
  const incoherences = detecterIncoherences(data)
  const trimestreActuel = trimestreDuMois(moisSelectionne)
  const trimestreActuelStr = `${trimestreActuel.annee}-Q${trimestreActuel.numero}`

  const handleChangerTrimestre = (str: string) => {
    const [a, q] = str.split("-Q")
    const cles = clesDuTrimestre(data.cles, Number(a), Number(q))
    if (cles.length > 0) setMoisSelectionne(cles[cles.length - 1])
  }

  return (
    <main className="mx-auto min-h-full max-w-7xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dashboard de présence — IKXO
          </h1>
          <p className="text-sm text-slate-500">
            Suivi de l'objectif « ≥2 jours/mois au bureau »
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SelecteurVue vue={vue} onChange={setVue} />
          {vue === "mensuelle" ? (
            <select
              value={moisSelectionne}
              onChange={(e) => setMoisSelectionne(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {[...data.cles].reverse().map((cle) => (
                <option key={cle} value={cle}>
                  {libelleMois(cle)}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={trimestreActuelStr}
              onChange={(e) => handleChangerTrimestre(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {trimestresDisponibles.map((str) => (
                <option key={str} value={str}>
                  {libelleTrimestre(str)}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {incoherences.length > 0 && (
        <BandeauIncoherences incoherences={incoherences} />
      )}

      {vue === "mensuelle" && <MonthView mois={mois} data={data} />}
      {vue === "trimestre" && <QuarterView mois={mois} data={data} />}
    </main>
  )
}

function Squelette() {
  return (
    <main className="mx-auto min-h-full max-w-7xl p-6">
      <div className="animate-pulse">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-2 h-7 w-72 rounded bg-slate-200" />
            <div className="h-4 w-56 rounded bg-slate-100" />
          </div>
          <div className="flex gap-3">
            <div className="h-8 w-44 rounded bg-slate-200" />
            <div className="h-8 w-32 rounded bg-slate-200" />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-lg border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-lg border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-lg border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
        <div className="h-96 rounded-lg border border-slate-200 bg-slate-100" />
      </div>
    </main>
  )
}

function AucunMois() {
  return (
    <main className="mx-auto min-h-full max-w-3xl p-8">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">
        Aucun mois de saisie disponible
      </h1>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700">
        <p className="mb-2">
          Le fichier Excel a bien été chargé, mais il ne contient aucun onglet
          au format <code className="rounded bg-white px-1.5 py-0.5 text-xs">
            Saisie YYYY-MM
          </code>.
        </p>
        <p>
          Ajoutez au moins un onglet (ex.{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">
            Saisie 2026-04
          </code>
          ) avec en ligne 3 les en-têtes « Consultant » + dates ouvrées + «
          Total » + « Statut OKR ».
        </p>
      </div>
    </main>
  )
}

function ErreurChargement({ message }: { message: string }) {
  return (
    <main className="mx-auto min-h-full max-w-3xl p-8">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">
        Erreur de chargement
      </h1>
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-slate-700">
        <p className="font-medium text-red-800">{message}</p>
        <p>
          Le fichier attendu doit se trouver à :{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">
            public/data/suivi_presence_consultants.xlsx
          </code>
        </p>
        <p>Il doit contenir les onglets suivants :</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">
              Référentiel
            </code>{" "}
            : col A = nom, col B = date d'entrée, col C = date de sortie
          </li>
          <li>
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">
              Événements
            </code>{" "}
            : col A = date, col B = type, col C = libellé
          </li>
          <li>
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">
              Saisie YYYY-MM
            </code>{" "}
            : un onglet par mois (ex. <code>Saisie 2026-04</code>) avec en
            ligne 3 les en-têtes « Consultant » + dates ouvrées + « Total » +
            « Statut OKR »
          </li>
        </ul>
      </div>
    </main>
  )
}

const ONGLETS_VUES: { id: Vue; label: string }[] = [
  { id: "mensuelle", label: "Mensuelle" },
  { id: "trimestre", label: "Trimestrielle" },
]

function SelecteurVue({
  vue,
  onChange,
}: {
  vue: Vue
  onChange: (v: Vue) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      {ONGLETS_VUES.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            vue === o.id
              ? "bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
              : "px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function BandeauIncoherences({
  incoherences,
}: {
  incoherences: Incoherence[]
}) {
  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="mb-1 font-medium text-amber-900">
        ⚠ {incoherences.length} incohérence
        {incoherences.length > 1 ? "s" : ""} détectée
        {incoherences.length > 1 ? "s" : ""} entre les saisies et le référentiel
      </p>
      <ul className="list-disc space-y-0.5 pl-6 text-amber-800">
        {incoherences.slice(0, 5).map((i, idx) => (
          <li key={idx}>
            <span className="font-medium">{i.consultant}</span> ({i.mois}) —{" "}
            {i.type === "absent_de_saisie"
              ? "présent au référentiel mais absent de la saisie du mois"
              : "saisi pour ce mois mais absent du référentiel"}
          </li>
        ))}
        {incoherences.length > 5 && (
          <li>… et {incoherences.length - 5} autre(s)</li>
        )}
      </ul>
    </div>
  )
}

const MOIS_LIBELLES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
]

function libelleMois(cle: MoisKey): string {
  const [annee, m] = cle.split("-")
  return `${MOIS_LIBELLES[parseInt(m, 10) - 1]} ${annee}`
}

function libelleTrimestre(str: string): string {
  const [annee, q] = str.split("-Q")
  return `Q${q} ${annee}`
}

export default App
