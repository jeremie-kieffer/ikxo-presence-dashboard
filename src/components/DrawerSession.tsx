import { useEffect, useMemo, useState } from "react"
import { PickerConsultant, nomFamille } from "./PickerConsultant"
import { Toast } from "./Toast"
import { supabase } from "../lib/supabase-client"
import {
  countFeedbacksSession,
  fetchParticipationsSession,
  type ConsultantAvecId,
  type ParticipationStatut,
  type SessionAvecStats,
} from "../lib/supabase-fetchers"

function pad3(n: number): string {
  return String(n).padStart(3, "0")
}

function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const j = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${j}`
}

// Éligibilité (décision 10) : role interne NON filtré, dateEntree NON bloquante ;
// visible si toujours actif (pas de sortie) ou encore présent à la date session.
function estEligible(c: ConsultantAvecId, dateSession: Date): boolean {
  if (!c.dateSortie) return true
  return isoLocal(c.dateSortie) >= isoLocal(dateSession)
}

// Prochain id F-YYYY-NNN pour l'année donnée.
function genererIdSession(
  sessions: SessionAvecStats[],
  annee: number,
): string {
  const prefixe = `F-${annee}-`
  let max = 0
  for (const s of sessions) {
    if (s.id.startsWith(prefixe)) {
      const n = Number.parseInt(s.id.slice(prefixe.length), 10)
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  return `${prefixe}${pad3(max + 1)}`
}

export function DrawerSession({
  session,
  consultants,
  sessionsExistantes,
  onClose,
  onSaved,
}: {
  session: SessionAvecStats | null
  consultants: ConsultantAvecId[]
  sessionsExistantes: SessionAvecStats[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const enEdition = session !== null

  const [monte, setMonte] = useState(false)
  const [date, setDate] = useState(session ? isoLocal(session.date) : "")
  const [thematique, setThematique] = useState(session?.thematique ?? "")
  const [lienSupport, setLienSupport] = useState(session?.lienSupport ?? "")
  const [assignations, setAssignations] = useState<
    Map<string, ParticipationStatut>
  >(new Map())
  const [initial, setInitial] = useState<{
    date: string
    thematique: string
    lienSupport: string
    assignations: Map<string, ParticipationStatut>
  }>({
    date: session ? isoLocal(session.date) : "",
    thematique: session?.thematique ?? "",
    lienSupport: session?.lienSupport ?? "",
    assignations: new Map(),
  })
  const [saveEnCours, setSaveEnCours] = useState(false)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [picker, setPicker] = useState<"formateur" | "inscrit" | null>(null)
  const [qParticipants, setQParticipants] = useState("")
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Animation d'entrée (slide depuis la droite).
  useEffect(() => {
    const t = setTimeout(() => setMonte(true), 10)
    return () => clearTimeout(t)
  }, [])

  // Édition : charge les participations existantes.
  useEffect(() => {
    if (!session) return
    let actif = true
    fetchParticipationsSession(session.id)
      .then((parts) => {
        if (!actif) return
        const m = new Map<string, ParticipationStatut>()
        for (const p of parts) m.set(p.consultantId, p.statut)
        setAssignations(new Map(m))
        setInitial((prev) => ({ ...prev, assignations: new Map(m) }))
      })
      .catch((e: Error) =>
        setToast({ type: "error", message: `Chargement : ${e.message}` }),
      )
    return () => {
      actif = false
    }
  }, [session])

  const dateEffective = date ? new Date(`${date}T12:00:00`) : new Date()
  const eligibles = useMemo(
    () => consultants.filter((c) => estEligible(c, dateEffective)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consultants, date],
  )
  const nomsById = useMemo(
    () => new Map(consultants.map((c) => [c.id, c.nom])),
    [consultants],
  )

  const formateurs = [...assignations].filter(([, s]) => s === "formateur")
  const inscrits = [...assignations].filter(([, s]) => s === "inscrit")
  const nbPresents = [...assignations].filter(([, s]) => s === "present").length

  const idsFormateurs = new Set(formateurs.map(([id]) => id))
  const idsInscrits = new Set(inscrits.map(([id]) => id))

  const listeParticipants = useMemo(() => {
    const rech = qParticipants.trim().toLowerCase()
    return eligibles
      .filter((c) => (rech ? c.nom.toLowerCase().includes(rech) : true))
      .sort((a, b) => {
        const aP = assignations.get(a.id) === "present" ? 0 : 1
        const bP = assignations.get(b.id) === "present" ? 0 : 1
        if (aP !== bP) return aP - bP
        return nomFamille(a.nom).localeCompare(nomFamille(b.nom), "fr")
      })
  }, [eligibles, assignations, qParticipants])

  // Nombre de modifications non sauvegardées.
  const nbModifs = useMemo(() => {
    let n = 0
    if (date !== initial.date) n++
    if (thematique !== initial.thematique) n++
    if (lienSupport !== initial.lienSupport) n++
    const cles = new Set([...assignations.keys(), ...initial.assignations.keys()])
    for (const c of cles) {
      if (assignations.get(c) !== initial.assignations.get(c)) n++
    }
    return n
  }, [date, thematique, lienSupport, assignations, initial])

  function affecter(id: string, statut: ParticipationStatut) {
    setAssignations((prev) => {
      const m = new Map(prev)
      m.set(id, statut) // auto-move : écrase l'ancien statut (exclusivité, choix b)
      return m
    })
  }
  function retirer(id: string) {
    setAssignations((prev) => {
      const m = new Map(prev)
      m.delete(id)
      return m
    })
  }
  function toggleParticipant(id: string) {
    setAssignations((prev) => {
      const m = new Map(prev)
      if (m.get(id) === "present") m.delete(id)
      else m.set(id, "present")
      return m
    })
  }

  function tenterFermer() {
    if (nbModifs > 0) {
      if (
        window.confirm("Modifications non enregistrées, quitter quand même ?")
      ) {
        onClose()
      }
      return
    }
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") tenterFermer()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nbModifs])

  async function enregistrer() {
    if (!date || thematique.trim() === "") {
      setToast({ type: "error", message: "Date et thématique sont obligatoires." })
      return
    }
    setSaveEnCours(true)
    try {
      const id = calculerId()
      const { error: eSession } = await supabase
        .from("sessions_formation")
        .upsert(
          {
            id,
            date,
            thematique: thematique.trim(),
            lien_support: lienSupport.trim() === "" ? null : lienSupport.trim(),
          },
          { onConflict: "id" },
        )
      if (eSession) throw new Error(eSession.message)

      const ops: Promise<void>[] = []
      // Suppressions : présents dans l'initial mais plus dans l'actuel.
      for (const [cid] of initial.assignations) {
        if (!assignations.has(cid)) {
          ops.push(
            (async () => {
              const { error } = await supabase
                .from("participations_formation")
                .delete()
                .eq("session_id", id)
                .eq("consultant_id", cid)
              if (error) throw new Error(error.message)
            })(),
          )
        }
      }
      // Upserts : nouveaux ou statut changé.
      for (const [cid, statut] of assignations) {
        if (initial.assignations.get(cid) !== statut) {
          ops.push(
            (async () => {
              const { error } = await supabase
                .from("participations_formation")
                .upsert(
                  { session_id: id, consultant_id: cid, statut },
                  { onConflict: "session_id,consultant_id" },
                )
              if (error) throw new Error(error.message)
            })(),
          )
        }
      }
      await Promise.all(ops)
      onSaved(`✅ Session ${id} enregistrée`)
    } catch (e) {
      setToast({
        type: "error",
        message: `Échec de l'enregistrement : ${(e as Error).message}`,
      })
    } finally {
      setSaveEnCours(false)
    }
  }

  // id de la session : existant en édition, généré en création.
  function calculerId(): string {
    if (session) return session.id
    return genererIdSession(
      sessionsExistantes,
      new Date(`${date}T12:00:00`).getFullYear(),
    )
  }

  async function supprimer() {
    if (!session) return
    setSuppressionEnCours(true)
    try {
      const n = await countFeedbacksSession(session.id)
      if (n > 0) {
        setToast({
          type: "error",
          message: `Impossible de supprimer une session ayant reçu des feedbacks (${n} retours). Contacte l'admin technique si nécessaire.`,
        })
        return
      }
      const { error: e1 } = await supabase
        .from("participations_formation")
        .delete()
        .eq("session_id", session.id)
      if (e1) throw new Error(e1.message)
      const { error: e2 } = await supabase
        .from("sessions_formation")
        .delete()
        .eq("id", session.id)
      if (e2) throw new Error(e2.message)
      onSaved(`Session ${session.id} supprimée`)
    } catch (e) {
      setToast({
        type: "error",
        message: `Échec de la suppression : ${(e as Error).message}`,
      })
    } finally {
      setSuppressionEnCours(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={tenterFermer}
        aria-hidden
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-white shadow-xl transition-transform duration-200 ${
          monte ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-ikxo-blue">
            {enEdition ? `Session ${session.id}` : "Nouvelle session"}
          </h2>
          <button
            type="button"
            onClick={tenterFermer}
            aria-label="Fermer"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ikxo-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Thématique *
            </label>
            <input
              type="text"
              maxLength={200}
              value={thematique}
              onChange={(e) => setThematique(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ikxo-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Lien support
            </label>
            <input
              type="url"
              value={lienSupport}
              onChange={(e) => setLienSupport(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ikxo-blue"
            />
          </div>

          {/* Formateurs */}
          <SectionAjout
            titre={`Formateurs (${formateurs.length})`}
            items={formateurs.map(([id]) => ({ id, nom: nomsById.get(id) ?? id }))}
            onRetirer={retirer}
            pickerOuvert={picker === "formateur"}
            onToggle={() => setPicker(picker === "formateur" ? null : "formateur")}
            eligibles={eligibles}
            exclure={idsFormateurs}
            onPick={(id) => affecter(id, "formateur")}
          />

          {/* Participants présents */}
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              Participants ({nbPresents} sélectionné{nbPresents > 1 ? "s" : ""})
            </p>
            <input
              type="text"
              value={qParticipants}
              onChange={(e) => setQParticipants(e.target.value)}
              placeholder="Rechercher un participant…"
              className="mb-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ikxo-blue"
            />
            <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
              {listeParticipants.map((c) => {
                const statut = assignations.get(c.id)
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={statut === "present"}
                      onChange={() => toggleParticipant(c.id)}
                    />
                    <span className="text-slate-700">{c.nom}</span>
                    {statut === "formateur" && (
                      <span className="text-[10px] font-medium text-ikxo-blue">
                        · formateur
                      </span>
                    )}
                    {statut === "inscrit" && (
                      <span className="text-[10px] font-medium text-slate-400">
                        · inscrit
                      </span>
                    )}
                  </label>
                )
              })}
              {listeParticipants.length === 0 && (
                <p className="px-3 py-3 text-xs text-slate-400">
                  Aucun consultant éligible à cette date.
                </p>
              )}
            </div>
          </div>

          {/* Inscrits non venus */}
          <SectionAjout
            titre={`Inscrits non venus (${inscrits.length})`}
            attenue
            items={inscrits.map(([id]) => ({ id, nom: nomsById.get(id) ?? id }))}
            onRetirer={retirer}
            pickerOuvert={picker === "inscrit"}
            onToggle={() => setPicker(picker === "inscrit" ? null : "inscrit")}
            eligibles={eligibles}
            exclure={idsInscrits}
            onPick={(id) => affecter(id, "inscrit")}
          />
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div className="flex items-center gap-3">
            {enEdition && (
              <button
                type="button"
                onClick={() => void supprimer()}
                disabled={suppressionEnCours}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                {suppressionEnCours ? "…" : "Supprimer cette session"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={
                nbModifs > 0 ? "text-xs text-ikxo-blue" : "text-xs text-slate-400"
              }
            >
              {nbModifs} modif{nbModifs > 1 ? "s" : ""} non sauvegardée
              {nbModifs > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => void enregistrer()}
              disabled={nbModifs === 0 || saveEnCours}
              className="rounded-md bg-ikxo-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-ikxo-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveEnCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

// Section réutilisable Formateurs / Inscrits : liste de pastilles + picker.
function SectionAjout({
  titre,
  items,
  onRetirer,
  pickerOuvert,
  onToggle,
  eligibles,
  exclure,
  onPick,
  attenue = false,
}: {
  titre: string
  items: { id: string; nom: string }[]
  onRetirer: (id: string) => void
  pickerOuvert: boolean
  onToggle: () => void
  eligibles: ConsultantAvecId[]
  exclure: Set<string>
  onPick: (id: string) => void
  attenue?: boolean
}) {
  return (
    <div>
      <p
        className={`mb-1 text-sm font-medium ${
          attenue ? "text-slate-500" : "text-slate-700"
        }`}
      >
        {titre}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((it) => (
          <span
            key={it.id}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
              attenue
                ? "bg-slate-100 text-slate-500"
                : "bg-ikxo-blue/10 text-ikxo-blue"
            }`}
          >
            {it.nom}
            <button
              type="button"
              onClick={() => onRetirer(it.id)}
              aria-label={`Retirer ${it.nom}`}
              className="hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:border-ikxo-blue hover:text-ikxo-blue"
          >
            + Ajouter
          </button>
          {pickerOuvert && (
            <PickerConsultant
              consultants={eligibles}
              exclure={exclure}
              onPick={onPick}
            />
          )}
        </div>
      </div>
    </div>
  )
}
