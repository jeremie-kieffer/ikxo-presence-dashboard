import { useEffect, useMemo, useState } from "react"
import { DrawerSession } from "../DrawerSession"
import { Toast } from "../Toast"
import {
  fetchConsultantsAvecId,
  fetchSessionsAvecStats,
  type ConsultantAvecId,
  type SessionAvecStats,
} from "../../lib/supabase-fetchers"

type Colonne =
  | "date"
  | "thematique"
  | "formateurs"
  | "nbParticipants"
  | "nbFeedbacks"

const COLONNES: { cle: Colonne; label: string; align?: "right" }[] = [
  { cle: "date", label: "Date" },
  { cle: "thematique", label: "Thématique" },
  { cle: "formateurs", label: "Formateur(s)" },
  { cle: "nbParticipants", label: "Participants", align: "right" },
  { cle: "nbFeedbacks", label: "Feedbacks", align: "right" },
]

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function VueSessionsFormation() {
  const [sessions, setSessions] = useState<SessionAvecStats[]>([])
  const [consultants, setConsultants] = useState<ConsultantAvecId[]>([])
  const [chargement, setChargement] = useState(true)
  const [tri, setTri] = useState<{ col: Colonne; sens: "asc" | "desc" }>({
    col: "date",
    sens: "desc",
  })
  const [drawer, setDrawer] = useState<
    { ouvert: false } | { ouvert: true; session: SessionAvecStats | null }
  >({ ouvert: false })
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  function recharger() {
    setChargement(true)
    fetchSessionsAvecStats()
      .then(setSessions)
      .catch((e: Error) =>
        setToast({ type: "error", message: `Chargement sessions : ${e.message}` }),
      )
      .finally(() => setChargement(false))
  }

  useEffect(() => {
    recharger()
    fetchConsultantsAvecId()
      .then(setConsultants)
      .catch((e: Error) =>
        setToast({ type: "error", message: `Chargement consultants : ${e.message}` }),
      )
  }, [])

  const sessionsTriees = useMemo(() => {
    const facteur = tri.sens === "asc" ? 1 : -1
    return [...sessions].sort((a, b) => {
      switch (tri.col) {
        case "date":
          return (a.date.getTime() - b.date.getTime()) * facteur
        case "thematique":
          return a.thematique.localeCompare(b.thematique, "fr") * facteur
        case "formateurs":
          return (
            a.formateurs.join(", ").localeCompare(b.formateurs.join(", "), "fr") *
            facteur
          )
        case "nbParticipants":
          return (a.nbParticipants - b.nbParticipants) * facteur
        case "nbFeedbacks":
          return (a.nbFeedbacks - b.nbFeedbacks) * facteur
      }
    })
  }, [sessions, tri])

  function trierPar(col: Colonne) {
    setTri((prev) =>
      prev.col === col
        ? { col, sens: prev.sens === "asc" ? "desc" : "asc" }
        : { col, sens: col === "date" ? "desc" : "asc" },
    )
  }

  function onSaved(message: string) {
    setDrawer({ ouvert: false })
    setToast({ type: "success", message })
    recharger()
  }

  return (
    <div>
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold leading-tight text-ikxo-blue">
            Sessions formation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {sessions.length} session{sessions.length > 1 ? "s" : ""} au catalogue
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ ouvert: true, session: null })}
          className="rounded-md bg-ikxo-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-ikxo-blue/90"
        >
          + Nouvelle session
        </button>
      </header>

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
                    className={`cursor-pointer select-none border-b border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:text-ikxo-blue ${
                      c.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {c.label}
                    {tri.col === c.cle && (tri.sens === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessionsTriees.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setDrawer({ ouvert: true, session: s })}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {formatDate(s.date)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{s.thematique}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {s.formateurs.join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {s.nbParticipants}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {s.nbFeedbacks}
                  </td>
                </tr>
              ))}
              {sessionsTriees.length === 0 && (
                <tr>
                  <td
                    colSpan={COLONNES.length}
                    className="px-3 py-10 text-center text-sm text-slate-400"
                  >
                    Aucune session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {drawer.ouvert && (
        <DrawerSession
          session={drawer.session}
          consultants={consultants}
          sessionsExistantes={sessions}
          onClose={() => setDrawer({ ouvert: false })}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
