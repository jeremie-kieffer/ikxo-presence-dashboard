import { useMemo, useState } from "react"
import { formatDateCourte } from "../../lib/format"
import { computeFormationKPIs } from "../../lib/kpi-calculators"
import type { DashboardData, SessionFormation } from "../../lib/types"
import { KPICard } from "../KPICard"

type TriSession = "date_desc" | "date_asc" | "participants_desc"

export function FormationView({ data }: { data: DashboardData }) {
  const kpi = useMemo(
    () => computeFormationKPIs(data.formations, data.participationsFormations),
    [data.formations, data.participationsFormations],
  )

  // Nombre de participants (P + F) par session, calculé à partir de la matrice.
  // Une seule passe : on remplit un Map<idSession, nb> en parcourant la matrice.
  const nbParticipantsParSession = useMemo(() => {
    const m = new Map<string, number>()
    for (const sessions of data.participationsFormations.values()) {
      for (const id of sessions.keys()) {
        m.set(id, (m.get(id) ?? 0) + 1)
      }
    }
    return m
  }, [data.participationsFormations])

  const [tri, setTri] = useState<TriSession>("date_desc")
  const sessionsTriees = useMemo(() => {
    const arr = [...data.formations]
    if (tri === "date_desc") arr.sort((a, b) => +b.date - +a.date)
    else if (tri === "date_asc") arr.sort((a, b) => +a.date - +b.date)
    else
      arr.sort(
        (a, b) =>
          (nbParticipantsParSession.get(b.idSession) ?? 0) -
          (nbParticipantsParSession.get(a.idSession) ?? 0),
      )
    return arr
  }, [data.formations, tri, nbParticipantsParSession])

  const topFormateur = kpi.topFormateurs[0]
  const topParticipant = kpi.topParticipants[0]

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titre="Sessions au catalogue"
          valeur={kpi.nbSessions}
          sousLibelle="depuis mars 2025"
          accent="violet"
        />
        <KPICard
          titre="Participants uniques"
          valeur={kpi.nbParticipantsUniques}
          sousLibelle="≥1 participation ou animation"
          accent="bleu"
        />
        <KPICard
          titre="Top formateur"
          valeur={topFormateur?.nom ?? "—"}
          sousLibelle={
            topFormateur ? `${topFormateur.nb} session(s) animée(s)` : undefined
          }
          accent="vert"
        />
        <KPICard
          titre="Top participant"
          valeur={topParticipant?.nom ?? "—"}
          sousLibelle={
            topParticipant
              ? `${topParticipant.nb} participation(s)`
              : undefined
          }
          accent="vert"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopList titre="Top 5 formateurs" lignes={kpi.topFormateurs} />
        <TopList titre="Top 5 participants" lignes={kpi.topParticipants} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Sessions ({sessionsTriees.length})
          </h2>
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as TriSession)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <option value="date_desc">Trier : date ↓</option>
            <option value="date_asc">Trier : date ↑</option>
            <option value="participants_desc">Trier : nb participants ↓</option>
          </select>
        </div>
        <SessionsTable
          sessions={sessionsTriees}
          nbParticipantsParSession={nbParticipantsParSession}
        />
      </section>

      <SectionConsultant data={data} />
    </div>
  )
}

function TopList({
  titre,
  lignes,
}: {
  titre: string
  lignes: { nom: string; nb: number }[]
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{titre}</h3>
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune donnée</p>
      ) : (
        <ol className="space-y-1.5">
          {lignes.map((l, i) => (
            <li
              key={l.nom}
              className="flex items-baseline justify-between text-sm"
            >
              <span className="text-slate-700">
                <span className="mr-2 inline-block w-4 text-right text-xs text-slate-400">
                  {i + 1}.
                </span>
                {l.nom}
              </span>
              <span className="font-semibold text-slate-900">{l.nb}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function SessionsTable({
  sessions,
  nbParticipantsParSession,
}: {
  sessions: SessionFormation[]
  nbParticipantsParSession: Map<string, number>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-2 text-left font-medium">Date</th>
            <th className="px-5 py-2 text-left font-medium">Thématique</th>
            <th className="px-5 py-2 text-left font-medium">Formateur(s)</th>
            <th className="px-5 py-2 text-right font-medium">Participants</th>
            <th className="px-5 py-2 text-left font-medium">Support</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.idSession}
              className="border-t border-slate-100 hover:bg-slate-50"
            >
              <td className="px-5 py-2 whitespace-nowrap text-slate-700">
                {formatDateCourte(s.date)}/{s.date.getFullYear()}
              </td>
              <td className="px-5 py-2 text-slate-800">{s.thematique}</td>
              <td className="px-5 py-2 text-slate-700">
                {s.formateurs.join(", ")}
              </td>
              <td className="px-5 py-2 text-right font-medium text-slate-900">
                {nbParticipantsParSession.get(s.idSession) ?? 0}
              </td>
              <td className="px-5 py-2">
                {s.lienSupport ? (
                  <a
                    href={s.lienSupport}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Lien
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionConsultant({ data }: { data: DashboardData }) {
  const nomsTries = useMemo(
    () =>
      [...data.participationsFormations.keys()].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [data.participationsFormations],
  )
  const [nomSel, setNomSel] = useState<string>(nomsTries[0] ?? "")

  const sessionsDuConsultant = useMemo(() => {
    const codes = data.participationsFormations.get(nomSel)
    if (!codes) return [] as { session: SessionFormation; role: "F" | "P" }[]
    const result: { session: SessionFormation; role: "F" | "P" }[] = []
    for (const [id, role] of codes) {
      const session = data.formations.find((f) => f.idSession === id)
      if (session) result.push({ session, role })
    }
    result.sort((a, b) => +b.session.date - +a.session.date)
    return result
  }, [data.formations, data.participationsFormations, nomSel])

  const nbF = sessionsDuConsultant.filter((s) => s.role === "F").length
  const nbP = sessionsDuConsultant.filter((s) => s.role === "P").length

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">
          Vue par consultant
        </h2>
        <select
          value={nomSel}
          onChange={(e) => setNomSel(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {nomsTries.map((nom) => (
            <option key={nom} value={nom}>
              {nom}
            </option>
          ))}
        </select>
      </div>
      <div className="px-5 py-3 text-sm text-slate-600">
        <span className="font-medium text-slate-900">{nbF}</span> animation
        {nbF > 1 ? "s" : ""} ·{" "}
        <span className="font-medium text-slate-900">{nbP}</span> participation
        {nbP > 1 ? "s" : ""}
      </div>
      {sessionsDuConsultant.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-slate-500">
          Aucune session pour ce consultant.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sessionsDuConsultant.map(({ session, role }) => (
            <li
              key={session.idSession}
              className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-2.5"
            >
              <div className="flex items-baseline gap-3">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
                    role === "F"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {role === "F" ? "Formateur" : "Participant"}
                </span>
                <span className="text-sm text-slate-800">
                  {session.thematique}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {formatDateCourte(session.date)}/{session.date.getFullYear()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
