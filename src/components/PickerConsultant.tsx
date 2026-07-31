import { useMemo, useState } from "react"
import type { ConsultantAvecId } from "../lib/supabase-fetchers"

// Tri « par nom de famille » = dernier mot du champ nom.
// "Achille Bruant" -> "Bruant".
export function nomFamille(nom: string): string {
  const parts = nom.trim().split(/\s+/)
  return parts[parts.length - 1] ?? nom
}

/**
 * Mini-picker déroulant réutilisable (Formateurs / Inscrits). Reçoit la liste
 * déjà filtrée par éligibilité ; exclut les consultants déjà assignés ; clic =
 * ajout. Reste ouvert pour permettre plusieurs ajouts.
 */
export function PickerConsultant({
  consultants,
  exclure,
  onPick,
}: {
  consultants: ConsultantAvecId[]
  exclure: Set<string>
  onPick: (consultantId: string) => void
}) {
  const [q, setQ] = useState("")

  const liste = useMemo(() => {
    const rech = q.trim().toLowerCase()
    return consultants
      .filter((c) => !exclure.has(c.id))
      .filter((c) => (rech ? c.nom.toLowerCase().includes(rech) : true))
      .sort((a, b) => nomFamille(a.nom).localeCompare(nomFamille(b.nom), "fr"))
  }, [consultants, exclure, q])

  return (
    <div className="absolute z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-ikxo-blue"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto py-1">
        {liste.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            >
              {c.nom}
            </button>
          </li>
        ))}
        {liste.length === 0 && (
          <li className="px-3 py-2 text-xs text-slate-400">Aucun consultant</li>
        )}
      </ul>
    </div>
  )
}
