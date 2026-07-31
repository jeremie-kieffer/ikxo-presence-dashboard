import { useEffect, useMemo, useState } from "react"
import { Toast } from "../Toast"
import { estActifCeMois } from "../../lib/kpi-calculators"
import { supabase } from "../../lib/supabase-client"
import {
  fetchConsultantsAvecId,
  fetchPresencesDuMois,
  type ConsultantAvecId,
  type PresenceStatut,
} from "../../lib/supabase-fetchers"
import type { DashboardData, Evenement } from "../../lib/types"

const MOIS_LIBELLES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]
const JOURS_LETTRES = ["L", "M", "M", "J", "V"] // lun..ven

// Cycle au clic : vide → present → intercontract → absence_longue → vide.
const CYCLE = ["", "present", "intercontract", "absence_longue"] as const

type MoisAffiche = { annee: number; mois: number }

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function libelleMois({ annee, mois }: MoisAffiche): string {
  return `${MOIS_LIBELLES[mois - 1]} ${annee}`
}

function joursOuvresDuMois(
  annee: number,
  mois: number,
): { iso: string; jour: number; dow: number }[] {
  const res: { iso: string; jour: number; dow: number }[] = []
  const nbJours = new Date(annee, mois, 0).getDate()
  for (let d = 1; d <= nbJours; d++) {
    const date = new Date(annee, mois - 1, d, 12)
    const dow = date.getDay() // 0=dim, 1-5=lun-ven, 6=sam
    if (dow >= 1 && dow <= 5) res.push({ iso: isoLocal(date), jour: d, dow })
  }
  return res
}

// Un consultant est-il actif un jour précis ? (fenêtre entrée/sortie, hors internes)
function estActifCeJour(c: ConsultantAvecId, iso: string): boolean {
  if (c.role === "interne") return false
  if (c.dateEntree && isoLocal(c.dateEntree) > iso) return false
  if (c.dateSortie && isoLocal(c.dateSortie) < iso) return false
  return true
}

// Style + libellé d'une cellule selon son statut.
function apparenceCellule(statut: string): { label: string; classes: string } {
  switch (statut) {
    case "present":
      return { label: "P", classes: "bg-emerald-100 text-emerald-800" }
    case "intercontract":
      return { label: "IC", classes: "bg-orange-100 text-orange-800" }
    case "absence_longue":
      return { label: "M", classes: "bg-slate-200 text-slate-600" }
    default:
      return { label: "", classes: "bg-white hover:bg-slate-50" }
  }
}

export function VueSaisiePresences({ data }: { data: DashboardData }) {
  const maintenant = new Date()
  const [moisAffiche, setMoisAffiche] = useState<MoisAffiche>({
    annee: maintenant.getFullYear(),
    mois: maintenant.getMonth() + 1,
  })
  const [consultants, setConsultants] = useState<ConsultantAvecId[]>([])
  const [presencesInitiales, setPresencesInitiales] = useState<
    Map<string, PresenceStatut>
  >(new Map())
  const [presencesModifiees, setPresencesModifiees] = useState<
    Map<string, string>
  >(new Map())
  const [chargement, setChargement] = useState(true)
  const [saveEnCours, setSaveEnCours] = useState(false)
  const [toast, setToast] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Consultants (avec id) : chargés une fois.
  useEffect(() => {
    let actif = true
    fetchConsultantsAvecId()
      .then((cs) => {
        if (actif) setConsultants(cs)
      })
      .catch((e: Error) =>
        setToast({ type: "error", message: `Chargement consultants : ${e.message}` }),
      )
    return () => {
      actif = false
    }
  }, [])

  // Présences du mois : rechargées à chaque changement de mois. On repart d'un
  // batch de modifs vide (les modifs sont spécifiques au mois précédent).
  useEffect(() => {
    let actif = true
    setChargement(true)
    fetchPresencesDuMois(moisAffiche.annee, moisAffiche.mois)
      .then((m) => {
        if (!actif) return
        setPresencesInitiales(m)
        setPresencesModifiees(new Map())
      })
      .catch((e: Error) =>
        setToast({ type: "error", message: `Chargement présences : ${e.message}` }),
      )
      .finally(() => {
        if (actif) setChargement(false)
      })
  }, [moisAffiche])

  const joursOuvres = useMemo(
    () => joursOuvresDuMois(moisAffiche.annee, moisAffiche.mois),
    [moisAffiche],
  )

  // Mois proposés : existants (dashboard) + mois en cours + mois suivant.
  const moisDisponibles = useMemo(() => {
    const set = new Set<string>(data.cles)
    const cur = `${maintenant.getFullYear()}-${pad2(maintenant.getMonth() + 1)}`
    const suiv = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 1)
    set.add(cur)
    set.add(`${suiv.getFullYear()}-${pad2(suiv.getMonth() + 1)}`)
    return [...set].sort().reverse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.cles])

  const evenementsParJour = useMemo(() => {
    const m = new Map<string, Evenement[]>()
    for (const e of data.evenements) {
      if (
        e.date.getFullYear() === moisAffiche.annee &&
        e.date.getMonth() + 1 === moisAffiche.mois
      ) {
        const iso = isoLocal(e.date)
        const arr = m.get(iso) ?? []
        arr.push(e)
        m.set(iso, arr)
      }
    }
    return m
  }, [data.evenements, moisAffiche])

  const lignes = useMemo(
    () =>
      consultants
        .filter((c) => estActifCeMois(c, moisAffiche.annee, moisAffiche.mois))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [consultants, moisAffiche],
  )

  const cle = (consultantId: string, iso: string) => `${consultantId}|${iso}`

  function valeurCellule(consultantId: string, iso: string): string {
    const k = cle(consultantId, iso)
    if (presencesModifiees.has(k)) return presencesModifiees.get(k) ?? ""
    return presencesInitiales.get(k) ?? ""
  }

  function estModifiee(consultantId: string, iso: string): boolean {
    return presencesModifiees.has(cle(consultantId, iso))
  }

  function cyclerCellule(consultantId: string, iso: string) {
    const k = cle(consultantId, iso)
    const actuelle = valeurCellule(consultantId, iso)
    const idx = (CYCLE as readonly string[]).indexOf(actuelle)
    const suivante = CYCLE[(idx + 1) % CYCLE.length]
    const initiale = presencesInitiales.get(k) ?? ""
    const modifs = new Map(presencesModifiees)
    if (suivante === initiale) modifs.delete(k)
    else modifs.set(k, suivante)
    setPresencesModifiees(modifs)
  }

  async function enregistrer() {
    if (presencesModifiees.size === 0) return
    setSaveEnCours(true)
    const n = presencesModifiees.size
    try {
      const ops = [...presencesModifiees].map(async ([k, statut]) => {
        const [consultantId, date] = k.split("|")
        if (statut === "") {
          const { error } = await supabase
            .from("presences")
            .delete()
            .eq("consultant_id", consultantId)
            .eq("date", date)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabase
            .from("presences")
            .upsert(
              { consultant_id: consultantId, date, statut },
              { onConflict: "consultant_id,date" },
            )
          if (error) throw new Error(error.message)
        }
      })
      await Promise.all(ops)

      // Fusion des modifs dans la base locale, puis reset du batch.
      const nouvelleInit = new Map(presencesInitiales)
      for (const [k, statut] of presencesModifiees) {
        if (statut === "") nouvelleInit.delete(k)
        else nouvelleInit.set(k, statut as PresenceStatut)
      }
      setPresencesInitiales(nouvelleInit)
      setPresencesModifiees(new Map())
      setToast({
        type: "success",
        message: `✅ ${n} modification${n > 1 ? "s" : ""} enregistrée${n > 1 ? "s" : ""}`,
      })
    } catch (e) {
      // On conserve presencesModifiees pour permettre un nouvel essai.
      setToast({
        type: "error",
        message: `Échec de l'enregistrement : ${(e as Error).message}`,
      })
    } finally {
      setSaveEnCours(false)
    }
  }

  const nbModifs = presencesModifiees.size
  const estMoisClos =
    moisAffiche.annee < maintenant.getFullYear() ||
    (moisAffiche.annee === maintenant.getFullYear() &&
      moisAffiche.mois < maintenant.getMonth() + 1)

  return (
    <div>
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold leading-tight text-ikxo-blue">
            Saisie des présences
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Clic sur une cellule : vide → P → IC → M → vide.
          </p>
        </div>
        <select
          value={`${moisAffiche.annee}-${pad2(moisAffiche.mois)}`}
          onChange={(e) => {
            const [a, m] = e.target.value.split("-").map(Number)
            setMoisAffiche({ annee: a, mois: m })
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {moisDisponibles.map((c) => {
            const [a, m] = c.split("-").map(Number)
            return (
              <option key={c} value={c}>
                {libelleMois({ annee: a, mois: m })}
              </option>
            )
          })}
        </select>
      </header>

      {estMoisClos && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Tu édites un mois clos ({libelleMois(moisAffiche)}).
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <span
          className={
            nbModifs > 0
              ? "text-sm font-medium text-ikxo-blue"
              : "text-sm text-slate-400"
          }
        >
          {nbModifs} modification{nbModifs > 1 ? "s" : ""} non sauvegardée
          {nbModifs > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => void enregistrer()}
          disabled={nbModifs === 0 || saveEnCours}
          className="rounded-md bg-ikxo-blue px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-ikxo-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveEnCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {chargement ? (
        <div className="py-16 text-center text-sm text-slate-400">Chargement…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">
                  Consultant
                </th>
                {joursOuvres.map((j) => {
                  const evts = evenementsParJour.get(j.iso)
                  return (
                    <th
                      key={j.iso}
                      className="border-b border-slate-200 px-1.5 py-1 text-center font-medium text-slate-500"
                    >
                      <div className="text-[11px] leading-none text-slate-400">
                        {JOURS_LETTRES[j.dow - 1]}
                      </div>
                      <div className="leading-tight">{j.jour}</div>
                      {evts && (
                        <div
                          title={evts.map((e) => e.libelle || e.type).join(", ")}
                          className="mt-0.5 rounded bg-violet-100 px-1 text-[9px] font-medium leading-tight text-violet-700"
                        >
                          {evts[0].type}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {lignes.map((c) => (
                <tr key={c.id} className="even:bg-slate-50/40">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-inherit px-3 py-1.5 font-medium text-slate-700">
                    {c.nom}
                  </td>
                  {joursOuvres.map((j) => {
                    const actif = estActifCeJour(c, j.iso)
                    if (!actif) {
                      return (
                        <td
                          key={j.iso}
                          className="cursor-not-allowed bg-slate-100 px-1.5 py-1.5 text-center text-slate-300"
                          title="Consultant hors période"
                        >
                          ·
                        </td>
                      )
                    }
                    const statut = valeurCellule(c.id, j.iso)
                    const { label, classes } = apparenceCellule(statut)
                    const modif = estModifiee(c.id, j.iso)
                    return (
                      <td key={j.iso} className="p-0">
                        <button
                          type="button"
                          onClick={() => cyclerCellule(c.id, j.iso)}
                          className={`h-8 w-full min-w-[34px] cursor-pointer px-1 text-center text-xs font-semibold ${classes} ${
                            modif ? "ring-1 ring-inset ring-ikxo-blue" : ""
                          }`}
                        >
                          {label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td
                    colSpan={joursOuvres.length + 1}
                    className="px-3 py-10 text-center text-sm text-slate-400"
                  >
                    Aucun consultant actif sur {libelleMois(moisAffiche)}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
