import { useEffect, useMemo, useState } from "react"
import { Sidebar, type Module } from "./components/Sidebar"
import { FormationView } from "./components/views/FormationView"
import { MonthView } from "./components/views/MonthView"
import { QuarterView } from "./components/views/QuarterView"
import { chargerDonnees } from "./lib/data-source"
import {
  clesDuTrimestre,
  detecterIncoherences,
  trimestreDuMois,
  type Incoherence,
} from "./lib/kpi-calculators"
import type { DashboardData, MoisKey } from "./lib/types"

type Vue = "mensuelle" | "trimestre"

const TITRES_MODULES: Record<Module, { titre: string; sousTitre: string }> = {
  presence: {
    titre: "Présence",
    sousTitre:
      "Suivi de la présence sur site des consultants — objectif ≥2 jours/mois au bureau",
  },
  formation: {
    titre: "Formation",
    sousTitre: "Sessions, animations et participations",
  },
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [moisSelectionne, setMoisSelectionne] = useState<MoisKey | null>(null)
  const [module, setModule] = useState<Module>("presence")
  const [vue, setVue] = useState<Vue>("mensuelle")

  useEffect(() => {
    chargerDonnees()
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

  const titres = TITRES_MODULES[module]

  return (
    <div
      className="grid min-h-full border-t-4 border-ikxo-blue"
      style={{ gridTemplateColumns: "220px 1fr" }}
    >
      <Sidebar
        module={module}
        onChange={setModule}
        dateMiseAJour={data.dateMiseAJour}
      />
      <main className="px-6 py-6">
        <header className="mb-6">
          <h2 className="text-[22px] font-semibold leading-tight text-ikxo-blue">
            {titres.titre}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{titres.sousTitre}</p>
        </header>

        {module === "presence" && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
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
        )}

        {module === "presence" && incoherences.length > 0 && (
          <BandeauIncoherences incoherences={incoherences} />
        )}

        {module === "presence" && vue === "mensuelle" && (
          <MonthView mois={mois} data={data} />
        )}
        {module === "presence" && vue === "trimestre" && (
          <QuarterView mois={mois} data={data} />
        )}
        {module === "formation" && <FormationView data={data} />}
      </main>
    </div>
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
          La connexion à Supabase a réussi, mais aucune présence n'est encore
          enregistrée en base.
        </p>
        <p>
          Ajoutez des présences dans la table{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">
            presences
          </code>{" "}
          (une ligne par présence, avec sa date) pour voir apparaître les mois
          de suivi.
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
          Impossible de charger les données depuis Supabase. Vérifie ta
          connexion réseau et réessaie.
        </p>
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
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 shadow-sm">
      {ONGLETS_VUES.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            vue === o.id
              ? "bg-ikxo-blue px-3 py-1.5 text-sm font-medium text-white"
              : "bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200"
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
  // <details> natif : accessible, fonctionne sans state React, et la
  // rotation du chevron est gérée via group-open: en CSS pur.
  const n = incoherences.length
  const pluriel = n > 1 ? "s" : ""
  return (
    <details className="group mb-6 rounded-md border border-amber-300 bg-amber-50 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium text-amber-900">
        <span>
          ⚠ {n} incohérence{pluriel} détectée{pluriel} entre les saisies et le
          référentiel
        </span>
        <ChevronIcon />
      </summary>
      <ul className="list-disc space-y-0.5 px-4 pb-4 pl-10 text-amber-800">
        {incoherences.slice(0, 5).map((i, idx) => (
          <li key={idx}>
            <span className="font-medium">{i.consultant}</span> ({i.mois}) —{" "}
            {i.type === "absent_de_saisie"
              ? "présent au référentiel mais absent de la saisie du mois"
              : "saisi pour ce mois mais absent du référentiel"}
          </li>
        ))}
        {n > 5 && <li>… et {n - 5} autre(s)</li>}
      </ul>
    </details>
  )
}

// Chevron Tabler (chevron-down). Pivote de -90° quand <details> est fermé
// pour devenir un chevron-right — une seule icône, animation CSS pure.
function ChevronIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 -rotate-90 transition-transform duration-150 group-open:rotate-0"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
