import { useEffect, useMemo, useState } from "react"
import { Toast } from "./Toast"
import {
  upsertConsultant,
  type ConsultantComplet,
} from "../lib/supabase-fetchers"
import type { RoleConsultant } from "../lib/types"

function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const j = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${j}`
}

export function DrawerConsultant({
  consultant,
  onClose,
  onSaved,
}: {
  consultant: ConsultantComplet | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const enEdition = consultant !== null

  const initial = useMemo(
    () => ({
      nom: consultant?.nom ?? "",
      // Création : défaut = aujourd'hui. Édition : valeur réelle (ou vide si la
      // date d'entrée n'est pas renseignée en base — ne PAS la forcer à ce jour).
      dateEntree: consultant
        ? consultant.dateEntree
          ? isoLocal(consultant.dateEntree)
          : ""
        : isoLocal(new Date()),
      dateSortie: consultant?.dateSortie ? isoLocal(consultant.dateSortie) : "",
      role: consultant?.role ?? ("consultant" as RoleConsultant),
    }),
    [consultant],
  )

  const [monte, setMonte] = useState(false)
  const [nom, setNom] = useState(initial.nom)
  const [dateEntree, setDateEntree] = useState(initial.dateEntree)
  const [dateSortie, setDateSortie] = useState(initial.dateSortie)
  const [role, setRole] = useState<RoleConsultant>(initial.role)
  const [saveEnCours, setSaveEnCours] = useState(false)
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMonte(true), 10)
    return () => clearTimeout(t)
  }, [])

  const nomValide = nom.trim().length >= 2
  const dateEntreeValide = dateEntree !== ""
  const dateSortieValide = dateSortie === "" || dateSortie >= dateEntree
  const valide = nomValide && dateEntreeValide && dateSortieValide

  const nbModifs = useMemo(() => {
    let n = 0
    if (nom !== initial.nom) n++
    if (dateEntree !== initial.dateEntree) n++
    if (dateSortie !== initial.dateSortie) n++
    if (role !== initial.role) n++
    return n
  }, [nom, dateEntree, dateSortie, role, initial])

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
    if (!valide) return
    setSaveEnCours(true)
    try {
      await upsertConsultant({
        id: consultant?.id,
        nom: nom.trim(),
        dateEntree,
        dateSortie: dateSortie === "" ? null : dateSortie,
        role,
      })
      onSaved(`✅ ${nom.trim()} enregistré`)
    } catch (e) {
      setToast({
        type: "error",
        message: `Échec de l'enregistrement : ${(e as Error).message}`,
      })
    } finally {
      setSaveEnCours(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
      <div className="absolute inset-0 bg-black/30" onClick={tenterFermer} aria-hidden />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-white shadow-xl transition-transform duration-200 ${
          monte ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-ikxo-blue">
            {enEdition ? consultant.nom : "Nouveau consultant"}
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
              Nom *
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Prénom Nom"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ikxo-blue"
            />
            {nom.trim().length > 0 && !nomValide && (
              <p className="mt-1 text-xs text-red-600">
                Le nom doit faire au moins 2 caractères.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">
              Date d'entrée *
            </label>
            <input
              type="date"
              value={dateEntree}
              onChange={(e) => setDateEntree(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ikxo-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">
              Date de sortie
            </label>
            <input
              type="date"
              value={dateSortie}
              onChange={(e) => setDateSortie(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ikxo-blue"
            />
            {!dateSortieValide && (
              <p className="mt-1 text-xs text-red-600">
                La date de sortie doit être postérieure ou égale à la date
                d'entrée.
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Laisser vide tant que le consultant est en poste.
            </p>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600">Rôle</span>
            <div className="mt-1.5 flex gap-4">
              {(["consultant", "interne"] as RoleConsultant[]).map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="role"
                    checked={role === r}
                    onChange={() => setRole(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              « interne » = membre du cabinet hors mission (non suivi par l'OKR).
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3">
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
            disabled={!valide || nbModifs === 0 || saveEnCours}
            className="rounded-md bg-ikxo-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-ikxo-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveEnCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  )
}
