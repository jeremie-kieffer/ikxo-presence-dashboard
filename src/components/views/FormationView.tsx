import { useMemo, useState } from "react"
import { formatDateCourte, formatFr } from "../../lib/format"
import {
  computeFeedbackKPIs,
  computeFeedbackParSession,
  computeFormationKPIs,
  nbParticipantsParSession as computeNbParticipantsParSession,
  noteMoyenneParFormateur,
} from "../../lib/kpi-calculators"
import {
  couleurNoteFormation,
  type CouleurValeur,
} from "../../lib/seuils-design"
import type {
  DashboardData,
  FeedbackParSession,
  SessionFormation,
} from "../../lib/types"
import { KPICard } from "../KPICard"

type TriSession = "date_desc" | "date_asc" | "participants_desc"

// Ordre canonique des 4 valeurs "application", utilisé pour la barre
// stackée et la légende. Toute autre valeur reçue par le parser tombe
// dans la catégorie "Pas sûr" visuellement (gris) — mais le compte est
// préservé : on n'agrège rien.
const ORDRE_APPLICATION = [
  "Oui immédiatement",
  "Oui mais j'ai besoin de plus de pratique",
  "Pas sûr",
  "Non",
] as const

const COULEUR_BG_APPLICATION: Record<string, string> = {
  "Oui immédiatement": "bg-ikxo-green",
  "Oui mais j'ai besoin de plus de pratique": "bg-ikxo-green/60",
  "Pas sûr": "bg-gray-300",
  Non: "bg-ikxo-orange",
}

const CLASSE_TEXTE_NOTE: Record<CouleurValeur, string> = {
  vert: "text-ikxo-green",
  bleu: "text-ikxo-blue",
  orange: "text-ikxo-orange",
}

export function FormationView({ data }: { data: DashboardData }) {
  const kpiFormation = useMemo(
    () => computeFormationKPIs(data.formations, data.participationsFormations),
    [data.formations, data.participationsFormations],
  )
  const kpiFeedback = useMemo(
    () =>
      computeFeedbackKPIs(
        data.feedbacksFormation,
        data.participationsFormations,
      ),
    [data.feedbacksFormation, data.participationsFormations],
  )
  const notesParFormateur = useMemo(
    () => noteMoyenneParFormateur(data.feedbacksFormation, data.formations),
    [data.feedbacksFormation, data.formations],
  )

  const nbParticipantsParSession = useMemo(
    () => computeNbParticipantsParSession(data.participationsFormations),
    [data.participationsFormations],
  )

  // Index session → infos feedback déjà calculées. Évite de recalculer à
  // chaque ouverture d'accordéon.
  const feedbackParSession = useMemo(() => {
    const m = new Map<string, FeedbackParSession>()
    for (const session of data.formations) {
      m.set(
        session.idSession,
        computeFeedbackParSession(
          session.idSession,
          data.feedbacksFormation,
          data.participationsFormations,
        ),
      )
    }
    return m
  }, [data.formations, data.feedbacksFormation, data.participationsFormations])

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

  const topFormateur = kpiFormation.topFormateurs[0]
  const topParticipant = kpiFormation.topParticipants[0]

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titre="Sessions au catalogue"
          valeur={kpiFormation.nbSessions}
          sousLibelle="depuis mars 2025"
          accent="bleu"
        />
        <KPICard
          titre="Participants uniques"
          valeur={kpiFormation.nbParticipantsUniques}
          sousLibelle="≥1 participation ou animation"
          accent="bleu"
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
        <KPICard
          titre="Top formateur"
          valeur={topFormateur?.nom ?? "—"}
          sousLibelle={
            topFormateur ? `${topFormateur.nb} session(s) animée(s)` : undefined
          }
          accent="vert"
        />
      </section>

      <SectionFeedbacks kpi={kpiFeedback} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopList
          titre="Top 5 participants"
          lignes={kpiFormation.topParticipants}
        />
        <TopFormateursList
          lignes={kpiFormation.topFormateurs}
          notesParFormateur={notesParFormateur}
        />
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
          feedbackParSession={feedbackParSession}
        />
      </section>

      <SectionConsultant data={data} />
    </div>
  )
}

// === Section Feedbacks (cards globaux) ===

function SectionFeedbacks({
  kpi,
}: {
  kpi: ReturnType<typeof computeFeedbackKPIs>
}) {
  if (kpi.nbFeedbacksTotal === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Aucun feedback collecté à ce jour.
      </section>
    )
  }
  const couleur = couleurNoteFormation(kpi.noteMoyenneGlobale)
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <KPICard
        titre="Note moyenne formations"
        valeur={
          <span>
            {formatFr(kpi.noteMoyenneGlobale)}
            <span className="ml-1 text-lg">⭐</span>
            <span className="ml-1 text-base font-normal text-gray-500">
              / 5
            </span>
          </span>
        }
        sousLibelle={`${kpi.nbFeedbacksTotal} retours sur ${kpi.nbSessionsAvecFeedback} sessions`}
        accent={couleur}
        couleurValeur={couleur}
      />
      <KPICard
        titre="Taux de retour"
        valeur={`${Math.round(kpi.tauxRetourMoyen * 100)} %`}
        sousLibelle="réponses sur participants (moyenne par session)"
        accent="bleu"
      />
      <BarreApplication distrib={kpi.distribApplication} />
    </section>
  )
}

function BarreApplication({ distrib }: { distrib: Record<string, number> }) {
  const total = Object.values(distrib).reduce((a, b) => a + b, 0)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Application du contenu
      </p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-md bg-slate-100">
        {ORDRE_APPLICATION.map((cat) => {
          const n = distrib[cat] ?? 0
          if (n === 0) return null
          const pct = (n / total) * 100
          return (
            <div
              key={cat}
              className={COULEUR_BG_APPLICATION[cat]}
              style={{ width: `${pct}%` }}
              title={`${cat} : ${n}`}
            />
          )
        })}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-slate-600">
        {ORDRE_APPLICATION.map((cat) => {
          const n = distrib[cat] ?? 0
          const pct = total > 0 ? Math.round((n / total) * 100) : 0
          return (
            <li key={cat} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-sm ${COULEUR_BG_APPLICATION[cat]}`}
                />
                <span className="truncate">{cat}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {pct}%
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// === Tops ===

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

function TopFormateursList({
  lignes,
  notesParFormateur,
}: {
  lignes: { nom: string; nb: number }[]
  notesParFormateur: Map<string, { note: number; nbSessionsAvecFeedback: number }>
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        Top 5 formateurs
      </h3>
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune donnée</p>
      ) : (
        <ol className="space-y-1.5">
          {lignes.map((l, i) => {
            const noteInfo = notesParFormateur.get(l.nom)
            const couleur = noteInfo
              ? CLASSE_TEXTE_NOTE[couleurNoteFormation(noteInfo.note)]
              : ""
            return (
              <li
                key={l.nom}
                className="flex items-baseline justify-between gap-2 text-sm"
              >
                <span className="min-w-0 text-slate-700">
                  <span className="mr-2 inline-block w-4 text-right text-xs text-slate-400">
                    {i + 1}.
                  </span>
                  {l.nom}
                  <span className="ml-1.5 text-xs text-slate-400">
                    • {l.nb} session{l.nb > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {noteInfo ? (
                    <span className={`font-semibold ${couleur}`}>
                      {formatFr(noteInfo.note)}/5
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

// === Table des sessions avec drill-down ===

function SessionsTable({
  sessions,
  nbParticipantsParSession,
  feedbackParSession,
}: {
  sessions: SessionFormation[]
  nbParticipantsParSession: Map<string, number>
  feedbackParSession: Map<string, FeedbackParSession>
}) {
  const [ouverte, setOuverte] = useState<string | null>(null)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-6 px-3 py-2"></th>
            <th className="px-5 py-2 text-left font-medium">Date</th>
            <th className="px-5 py-2 text-left font-medium">Thématique</th>
            <th className="px-5 py-2 text-left font-medium">Formateur(s)</th>
            <th className="px-5 py-2 text-right font-medium">Participants</th>
            <th className="px-5 py-2 text-right font-medium">Note</th>
            <th className="px-5 py-2 text-right font-medium">Retours</th>
            <th className="px-5 py-2 text-left font-medium">Support</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const fb = feedbackParSession.get(s.idSession)
            const couleurNote = fb?.noteMoyenne
              ? CLASSE_TEXTE_NOTE[couleurNoteFormation(fb.noteMoyenne)]
              : ""
            const estOuverte = ouverte === s.idSession
            const toggle = () =>
              setOuverte(estOuverte ? null : s.idSession)
            return (
              <SessionRow
                key={s.idSession}
                session={s}
                nbParticipants={
                  nbParticipantsParSession.get(s.idSession) ?? 0
                }
                fb={fb}
                couleurNote={couleurNote}
                ouverte={estOuverte}
                onToggle={toggle}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SessionRow({
  session,
  nbParticipants,
  fb,
  couleurNote,
  ouverte,
  onToggle,
}: {
  session: SessionFormation
  nbParticipants: number
  fb: FeedbackParSession | undefined
  couleurNote: string
  ouverte: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-slate-400">
          <Chevron ouverte={ouverte} />
        </td>
        <td className="px-5 py-2 whitespace-nowrap text-slate-700">
          {formatDateCourte(session.date)}/{session.date.getFullYear()}
        </td>
        <td className="px-5 py-2 text-slate-800">{session.thematique}</td>
        <td className="px-5 py-2 text-slate-700">
          {session.formateurs.join(", ")}
        </td>
        <td className="px-5 py-2 text-right font-medium text-slate-900 tabular-nums">
          {nbParticipants}
        </td>
        <td className="px-5 py-2 text-right tabular-nums">
          {fb && fb.noteMoyenne !== null ? (
            <span className={`font-semibold ${couleurNote}`}>
              {formatFr(fb.noteMoyenne)} ⭐
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-5 py-2 text-right text-slate-700 tabular-nums">
          {fb && fb.nbRetours > 0 ? (
            <>
              {fb.nbRetours} / {fb.nbParticipants}
              <span className="ml-1 text-xs text-slate-400">
                ({Math.round(fb.tauxRetour * 100)} %)
              </span>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-5 py-2" onClick={(e) => e.stopPropagation()}>
          {session.lienSupport ? (
            <a
              href={session.lienSupport}
              target="_blank"
              rel="noreferrer"
              className="text-ikxo-blue hover:text-ikxo-fluor hover:underline"
            >
              Lien
            </a>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
      </tr>
      {ouverte && (
        <tr className="border-t border-slate-100 bg-slate-50/60">
          <td colSpan={8} className="px-5 py-5">
            <DrillDownSession session={session} fb={fb} />
          </td>
        </tr>
      )}
    </>
  )
}

function Chevron({ ouverte }: { ouverte: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 transition-transform duration-150 ${
        ouverte ? "rotate-90" : ""
      }`}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

// === Drill-down détaillé par session ===

function DrillDownSession({
  session,
  fb,
}: {
  session: SessionFormation
  fb: FeedbackParSession | undefined
}) {
  if (!fb || fb.nbRetours === 0) {
    return (
      <p className="text-center text-sm text-slate-500">
        Aucun retour collecté pour cette session.
      </p>
    )
  }

  const apprecies = fb.feedbacks.filter((f) => f.verbatimApprecie.trim() !== "")
  const ameliorations = fb.feedbacks.filter(
    (f) => f.verbatimAmelioration.trim() !== "",
  )
  const commentaires = fb.feedbacks.filter(
    (f) => f.verbatimCommentaire.trim() !== "",
  )

  // Pour la mini-barre Application : on filtre la distrib sur cette session.
  const distribApp: Record<string, number> = {}
  for (const f of fb.feedbacks) {
    distribApp[f.application] = (distribApp[f.application] ?? 0) + 1
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DistributionNotes fb={fb} />
        <BarreApplication distrib={distribApp} />
      </div>

      <div className="space-y-4">
        <BlocVerbatims
          titre="Ce qui a marché"
          verbatims={apprecies.map((f) => ({
            timestamp: f.timestamp,
            texte: f.verbatimApprecie,
          }))}
          fond="bg-ikxo-green/10"
        />
        <BlocVerbatims
          titre="Axes d'amélioration"
          verbatims={ameliorations.map((f) => ({
            timestamp: f.timestamp,
            texte: f.verbatimAmelioration,
          }))}
          fond="bg-gray-50"
        />
        {commentaires.length > 0 && (
          <BlocVerbatims
            titre="Autres retours"
            verbatims={commentaires.map((f) => ({
              timestamp: f.timestamp,
              texte: f.verbatimCommentaire,
            }))}
            fond="bg-ikxo-blue/5"
          />
        )}
        {/* Indicateur muet visuel pour clarifier que la session existe et a été utilisée */}
        <p className="text-xs text-slate-400">
          Session {session.idSession} — {fb.nbRetours} retour
          {fb.nbRetours > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  )
}

function DistributionNotes({ fb }: { fb: FeedbackParSession }) {
  const note = fb.noteMoyenne ?? 0
  const couleur = CLASSE_TEXTE_NOTE[couleurNoteFormation(note)]
  const maxBar = Math.max(...Object.values(fb.distributionNotes), 1)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Note moyenne
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-3xl font-semibold ${couleur}`}>
          {formatFr(note)}
        </span>
        <span className="text-lg">⭐</span>
        <span className="ml-1 text-sm text-slate-500">/ 5</span>
      </div>
      <div className="mt-4 space-y-1.5">
        {[5, 4, 3, 2, 1].map((n) => {
          const v = fb.distributionNotes[n] ?? 0
          const pct = (v / maxBar) * 100
          return (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-slate-500 tabular-nums">{n}</span>
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-100">
                  <div
                    className="h-full bg-ikxo-blue"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="w-6 text-right tabular-nums text-slate-500">
                {v}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BlocVerbatims({
  titre,
  verbatims,
  fond,
}: {
  titre: string
  verbatims: { timestamp: Date; texte: string }[]
  fond: string
}) {
  if (verbatims.length === 0) {
    return (
      <div className={`rounded-lg ${fond} p-4`}>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {titre}
        </h4>
        <p className="text-sm italic text-slate-500">Aucun verbatim.</p>
      </div>
    )
  }
  return (
    <div className={`rounded-lg ${fond} p-4`}>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {titre} ({verbatims.length})
      </h4>
      <ul className="space-y-2">
        {verbatims.map((v, i) => (
          <li
            key={i}
            className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700"
          >
            <p className="whitespace-pre-wrap leading-relaxed">
              <span className="mr-1 text-slate-300">«</span>
              {v.texte}
              <span className="ml-1 text-slate-300">»</span>
            </p>
            <p className="mt-1.5 text-xs text-slate-400">
              {formatDateCourte(v.timestamp)}/{v.timestamp.getFullYear()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// === Vue par consultant (inchangée) ===

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
