import { useMemo, useState } from "react"
import { Toast } from "./Toast"
import { importerFeedbacks } from "../lib/supabase-fetchers"
import {
  parserCSVFeedbacks,
  type FeedbackParsed,
  type ResultatParsing,
} from "../lib/parser-csv-feedbacks"

function tronquer(s: string, n = 50): string {
  const t = s.trim()
  return t.length > n ? t.slice(0, n) + "…" : t
}

function dateCourte(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ModalImportFeedbacks({
  sessionId,
  idsExistants,
  onClose,
  onImported,
}: {
  sessionId: string
  idsExistants: Set<string>
  onClose: () => void
  onImported: (nb: number) => void
}) {
  const [fichierNom, setFichierNom] = useState<string | null>(null)
  const [resultat, setResultat] = useState<ResultatParsing | null>(null)
  const [erreurParsing, setErreurParsing] = useState<string | null>(null)
  const [survol, setSurvol] = useState(false)
  const [importEnCours, setImportEnCours] = useState(false)
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  async function traiterFichier(file: File) {
    setFichierNom(file.name)
    setResultat(null)
    setErreurParsing(null)
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErreurParsing("Le fichier doit être un .csv exporté depuis Google Forms.")
      return
    }
    try {
      const texte = await file.text()
      setResultat(parserCSVFeedbacks(texte, sessionId))
    } catch (e) {
      setErreurParsing((e as Error).message)
    }
  }

  const { nouveaux, dejaEnBase } = useMemo(() => {
    if (!resultat) return { nouveaux: [] as FeedbackParsed[], dejaEnBase: 0 }
    const nvx: FeedbackParsed[] = []
    let deja = 0
    for (const f of resultat.valides) {
      if (idsExistants.has(f.id)) deja++
      else nvx.push(f)
    }
    return { nouveaux: nvx, dejaEnBase: deja }
  }, [resultat, idsExistants])

  async function importer() {
    if (nouveaux.length === 0) return
    setImportEnCours(true)
    try {
      await importerFeedbacks(nouveaux)
      onImported(nouveaux.length)
    } catch (e) {
      setToast({
        type: "error",
        message: `Échec de l'import : ${(e as Error).message}`,
      })
    } finally {
      setImportEnCours(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-ikxo-blue">
            Importer des feedbacks — session {sessionId}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Étape 1 : zone de dépôt */}
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setSurvol(true)
            }}
            onDragLeave={() => setSurvol(false)}
            onDrop={(e) => {
              e.preventDefault()
              setSurvol(false)
              const f = e.dataTransfer.files[0]
              if (f) void traiterFichier(f)
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${
              survol
                ? "border-ikxo-blue bg-ikxo-blue/5 text-ikxo-blue"
                : "border-slate-300 text-slate-500 hover:border-ikxo-blue"
            }`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void traiterFichier(f)
              }}
            />
            Glisse ton CSV Google Forms ici, ou clique pour choisir un fichier.
            {fichierNom && (
              <span className="mt-1 text-xs font-medium text-slate-600">
                {fichierNom}
              </span>
            )}
          </label>

          {erreurParsing && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreurParsing}
            </div>
          )}

          {/* Étape 2 : prévisualisation */}
          {resultat && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-slate-600">
                <span className="font-medium text-ikxo-blue">
                  {resultat.valides.length}
                </span>{" "}
                feedback{resultat.valides.length > 1 ? "s" : ""} détecté
                {resultat.valides.length > 1 ? "s" : ""},{" "}
                <span className="font-medium">{dejaEnBase}</span> déjà en base,{" "}
                <span className="font-medium">{resultat.invalides.length}</span>{" "}
                ligne{resultat.invalides.length > 1 ? "s" : ""} invalide
                {resultat.invalides.length > 1 ? "s" : ""}.
              </p>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-2 py-1.5 text-left font-medium">Date</th>
                      <th className="px-2 py-1.5 text-center font-medium">Note</th>
                      <th className="px-2 py-1.5 text-left font-medium">
                        Application
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium">
                        Apprécié
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultat.valides.map((f) => {
                      const deja = idsExistants.has(f.id)
                      return (
                        <tr
                          key={f.id}
                          className={`border-t border-slate-100 ${
                            deja ? "bg-slate-50 text-slate-400" : "text-slate-700"
                          }`}
                        >
                          <td className="whitespace-nowrap px-2 py-1.5">
                            {dateCourte(f.timestamp)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {f.note_globale}
                          </td>
                          <td className="px-2 py-1.5">
                            {tronquer(f.application)}
                          </td>
                          <td className="px-2 py-1.5">
                            {deja ? (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                Déjà en base
                              </span>
                            ) : (
                              tronquer(f.verbatim_apprecie)
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {resultat.invalides.map((inv) => (
                      <tr
                        key={`inv-${inv.ligne}`}
                        className="border-t border-slate-100 bg-red-50 text-red-700"
                      >
                        <td className="px-2 py-1.5" colSpan={4}>
                          Ligne {inv.ligne} ignorée — {inv.raison} ({tronquer(inv.apercu, 30)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Étape 3 : actions */}
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void importer()}
            disabled={!resultat || nouveaux.length === 0 || importEnCours}
            className="rounded-md bg-ikxo-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-ikxo-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importEnCours
              ? "Import…"
              : `Importer les ${nouveaux.length} nouveau${
                  nouveaux.length > 1 ? "x" : ""
                } feedback${nouveaux.length > 1 ? "s" : ""}`}
          </button>
        </footer>
      </div>
    </div>
  )
}
