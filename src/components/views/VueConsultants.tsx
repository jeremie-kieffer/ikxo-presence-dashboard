import { useEffect, useMemo, useState } from "react"
import { DrawerConsultant } from "../DrawerConsultant"
import { nomFamille } from "../PickerConsultant"
import { Toast } from "../Toast"
import {
  fetchTousConsultants,
  type ConsultantComplet,
} from "../../lib/supabase-fetchers"

type Colonne = "nom" | "role" | "dateEntree" | "dateSortie"
type Filtre = "actifs" | "tous"

const COLONNES: { cle: Colonne; label: string }[] = [
  { cle: "nom", label: "Nom" },
  { cle: "role", label: "Rôle" },
  { cle: "dateEntree", label: "Date d'entrée" },
  { cle: "dateSortie", label: "Date de sortie" },
]

function formatDate(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// Actif = pas de sortie, ou sortie dans le futur.
function estActifAujourdhui(c: ConsultantComplet): boolean {
  if (!c.dateSortie) return true
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)
  return c.dateSortie.getTime() > aujourdhui.getTime()
}

function tempsOuInfini(d: Date | null): number {
  return d ? d.getTime() : Number.POSITIVE_INFINITY
}

export function VueConsultants() {
  const [consultants, setConsultants] = useState<ConsultantComplet[]>([])
  const [chargement, setChargement] = useState(true)
  const [filtre, setFiltre] = useState<Filtre>("actifs")
  const [tri, setTri] = useState<{ col: Colonne; sens: "asc" | "desc" }>({
    col: "nom",
    sens: "asc",
  })
  const [drawer, setDrawer] = useState<
    { ouvert: false } | { ouvert: true; consultant: ConsultantComplet | null }
  >({ ouvert: false })
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  function recharger() {
    setChargement(true)
    fetchTousConsultants()
      .then(setConsultants)
      .catch((e: Error) =>
        setToast({ type: "error", message: `Chargement : ${e.message}` }),
      )
      .finally(() => setChargement(false))
  }

  useEffect(() => {
    recharger()
  }, [])

  const lignes = useMemo(() => {
    const filtrees =
      filtre === "actifs" ? consultants.filter(estActifAujourdhui) : consultants
    const facteur = tri.sens === "asc" ? 1 : -1
    return [...filtrees].sort((a, b) => {
      switch (tri.col) {
        case "nom":
          return nomFamille(a.nom).localeCompare(nomFamille(b.nom), "fr") * facteur
        case "role":
          return a.role.localeCompare(b.role, "fr") * facteur
        case "dateEntree":
          return (tempsOuInfini(a.dateEntree) - tempsOuInfini(b.dateEntree)) * facteur
        case "dateSortie":
          return (tempsOuInfini(a.dateSortie) - tempsOuInfini(b.dateSortie)) * facteur
      }
    })
  }, [consultants, filtre, tri])

  function trierPar(col: Colonne) {
    setTri((prev) =>
      prev.col === col
        ? { col, sens: prev.sens === "asc" ? "desc" : "asc" }
        : { col, sens: "asc" },
    )
  }

  function onSaved(message: string) {
    setDrawer({ ouvert: false })
    setToast({ type: "success", message })
    recharger()
  }

  const nbActifs = consultants.filter(estActifAujourdhui).length

  return (
    <div>
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold leading-tight text-ikxo-blue">
            Consultants
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {consultants.length} au référentiel · {nbActifs} actifs
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ ouvert: true, consultant: null })}
          className="rounded-md bg-ikxo-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-ikxo-blue/90"
        >
          + Ajouter
        </button>
      </header>

      <div className="mb-4 inline-flex overflow-hidden rounded-md border border-slate-300 shadow-sm">
        {(["actifs", "tous"] as Filtre[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltre(f)}
            className={
              filtre === f
                ? "bg-ikxo-blue px-3 py-1.5 text-sm font-medium text-white"
                : "bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200"
            }
          >
            {f === "actifs" ? "Actifs" : "Tous"}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="py-16 text-center text-sm text-slate-400">Chargement…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                {COLONNES.map((c) => (
                  <th
                    key={c.cle}
                    onClick={() => trierPar(c.cle)}
                    className="cursor-pointer select-none border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 hover:text-ikxo-blue"
                  >
                    {c.label}
                    {tri.col === c.cle && (tri.sens === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setDrawer({ ouvert: true, consultant: c })}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-medium text-slate-700">{c.nom}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.role === "interne"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-ikxo-blue/10 text-ikxo-blue"
                      }`}
                    >
                      {c.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {formatDate(c.dateEntree)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 ${
                      c.dateSortie ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {formatDate(c.dateSortie)}
                  </td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td
                    colSpan={COLONNES.length}
                    className="px-3 py-10 text-center text-sm text-slate-400"
                  >
                    Aucun consultant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {drawer.ouvert && (
        <DrawerConsultant
          consultant={drawer.consultant}
          onClose={() => setDrawer({ ouvert: false })}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
