/**
 * Fetchers Supabase pour le dashboard.
 *
 * Expose `fetchDashboardData()` qui retourne un `DashboardData` STRICTEMENT
 * compatible en shape avec ce que produit `parserBuffer()` (excel-parser.ts) :
 * les composants UI et les calculateurs KPI sont donc interchangeables entre la
 * source Excel et la source Supabase, sans modification.
 *
 * Découpage : un fetch = une table (`select('*')`), mappé vers le type React.
 * La recomposition des structures dérivées (matrices mensuelles, formateurs par
 * session, map de participations) se fait dans `fetchDashboardData`.
 *
 * Rappels sur les écarts imposés par le passage au format long en base :
 *  - `sessions_formation` n'a pas de colonne formateur : les formateurs se
 *    déduisent de `participations_formation` (statut 'formateur').
 *  - La matrice de présence d'origine (jours ouvrés sans présence, consultants à
 *    0 présence) n'est pas reconstructible : `joursOuvres` = union des dates
 *    effectivement présentes dans le mois. Suffisant pour tous les calculs OKR.
 *  - Le statut de participation 'inscrit' n'a pas d'équivalent dans le type
 *    `RoleFormation` ('F' | 'P') : il est ignoré, comme le fait parserBuffer.
 */
import { supabase } from "./supabase-client"
import { estActifCeMois } from "./kpi-calculators"
import type {
  CelluleSaisie,
  Consultant,
  ConsultantMois,
  DashboardData,
  Evenement,
  FeedbackFormation,
  MoisData,
  MoisKey,
  ParticipationsFormation,
  RoleFormation,
  SessionFormation,
} from "./types"

// === Types bruts (format long tel que stocké en base) ===

type PresenceStatut = "present" | "intercontract" | "absence_longue"
type ParticipationStatut = "formateur" | "present" | "inscrit"

export interface PresenceRaw {
  consultant_id: string
  date: string // ISO 'YYYY-MM-DD'
  statut: PresenceStatut
}

export interface ParticipationRaw {
  session_id: string
  consultant_id: string
  statut: ParticipationStatut
}

// Lignes brutes des tables restantes (colonnes DB, snake_case).
interface ConsultantRow {
  id: string
  nom: string
  date_entree: string | null
  date_sortie: string | null
  role: string
}

interface SessionRow {
  id: string
  date: string | null
  thematique: string | null
  lien_support: string | null
}

interface EvenementRow {
  date: string
  type: string | null
  libelle: string | null
}

interface FeedbackRow {
  id: string
  session_id: string
  timestamp: string
  note_globale: number
  application: string | null
  verbatim_apprecie: string | null
  verbatim_amelioration: string | null
  verbatim_commentaire: string | null
}

// === Helpers ===

/**
 * `select('*')` générique avec remontée d'erreur explicite (fail-fast : on
 * préfère planter clairement qu'exploiter un jeu de données partiel).
 * NB : Supabase plafonne un select à 1000 lignes par défaut ; toutes les tables
 * du projet sont bien en-dessous (presences ≈ 354, participations ≈ 145).
 */
async function selectAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*")
  if (error) {
    throw new Error(`Supabase : échec du fetch de '${table}' — ${error.message}`)
  }
  return (data ?? []) as T[]
}

function mapConsultant(r: ConsultantRow): Consultant {
  return {
    nom: r.nom,
    dateEntree: r.date_entree ? new Date(r.date_entree) : null,
    dateSortie: r.date_sortie ? new Date(r.date_sortie) : null,
    role: r.role === "interne" ? "interne" : "consultant",
  }
}

function statutPresenceEnCellule(statut: PresenceStatut): CelluleSaisie {
  switch (statut) {
    case "present":
      return 1
    case "intercontract":
      return "IC"
    case "absence_longue":
      return "M"
  }
}

// === Fetchers par table ===

async function fetchConsultantsRaw(): Promise<ConsultantRow[]> {
  return selectAll<ConsultantRow>("consultants")
}

export async function fetchConsultants(): Promise<Consultant[]> {
  const rows = await fetchConsultantsRaw()
  return rows.map(mapConsultant)
}

/**
 * Sessions du catalogue. `formateurs` est laissé vide ici (la table ne porte pas
 * cette information) et rempli par `fetchDashboardData` à partir des
 * participations. Tri chronologique croissant, comme le catalogue Excel.
 */
export async function fetchSessionsFormation(): Promise<SessionFormation[]> {
  const rows = await selectAll<SessionRow>("sessions_formation")
  return rows
    .filter((r) => r.date != null) // parserBuffer ignore les sessions sans date
    .map((r) => ({
      idSession: r.id,
      date: new Date(r.date as string),
      thematique: r.thematique ?? "",
      formateurs: [] as string[],
      lienSupport: r.lien_support ?? undefined,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

export async function fetchEvenements(): Promise<Evenement[]> {
  const rows = await selectAll<EvenementRow>("evenements")
  return rows.map((r) => ({
    date: new Date(r.date),
    type: r.type ?? "",
    libelle: r.libelle ?? "",
  }))
}

export async function fetchPresences(): Promise<PresenceRaw[]> {
  return selectAll<PresenceRaw>("presences")
}

export async function fetchParticipations(): Promise<ParticipationRaw[]> {
  return selectAll<ParticipationRaw>("participations_formation")
}

export async function fetchFeedbacks(): Promise<FeedbackFormation[]> {
  const rows = await selectAll<FeedbackRow>("feedbacks_formation")
  return rows.map((r) => ({
    idResponse: r.id,
    idSession: r.session_id,
    timestamp: new Date(r.timestamp),
    noteGlobale: r.note_globale,
    application: r.application ?? "",
    verbatimApprecie: r.verbatim_apprecie ?? "",
    verbatimAmelioration: r.verbatim_amelioration ?? "",
    verbatimCommentaire: r.verbatim_commentaire ?? "",
  }))
}

// === Recomposition des structures dérivées ===

/**
 * Reconstitue les matrices mensuelles (`MoisData`) à partir des présences en
 * format long. La clé de mois est dérivée de la string ISO ('YYYY-MM'), et non
 * de l'objet Date, pour être insensible au fuseau horaire.
 *
 * Point clé : la table `presences` ne stocke que les faits positifs. Un
 * consultant actif mais absent tout le mois n'a aucune ligne. On reconstruit
 * donc le roster mensuel depuis le Référentiel (source de vérité de « qui est
 * actif ce mois », via `estActifCeMois`), puis on plaque les présences réelles
 * par-dessus. Sans ça, les consultants à 0 présence disparaissaient des KPI.
 */
function construireMois(
  presences: PresenceRaw[],
  consultants: Consultant[],
  idToNom: Map<string, string>,
  evenements: Evenement[],
): { mois: Record<MoisKey, MoisData>; cles: MoisKey[] } {
  // On ne matérialise que les mois où au moins une présence existe.
  const parMois = new Map<MoisKey, PresenceRaw[]>()
  for (const p of presences) {
    if (!idToNom.has(p.consultant_id)) continue // présence orpheline : ignorée
    const cle = p.date.slice(0, 7)
    const bucket = parMois.get(cle)
    if (bucket) bucket.push(p)
    else parMois.set(cle, [p])
  }

  const mois: Record<MoisKey, MoisData> = {}
  for (const [cle, lignesMois] of parMois) {
    const [annee, moisNum] = cle.split("-").map(Number)

    // joursOuvres = tous les jours ouvrés (lun-ven) du mois calendaire, pas
    // seulement ceux ayant eu une présence. Dates à midi local (cohérent avec
    // le parser Excel) ; clé ISO 'YYYY-MM-DD' en parallèle pour les lookups.
    const joursOuvres: Date[] = []
    const joursIso: string[] = []
    const nbJoursDuMois = new Date(annee, moisNum, 0).getDate()
    for (let d = 1; d <= nbJoursDuMois; d++) {
      const date = new Date(annee, moisNum - 1, d, 12, 0, 0)
      const dow = date.getDay() // 0=dim, 1-5=lun-ven, 6=sam
      if (dow < 1 || dow > 5) continue
      joursOuvres.push(date)
      joursIso.push(`${cle}-${String(d).padStart(2, "0")}`)
    }

    // Présences réelles indexées par nom puis par date ISO.
    const presencesParNom = new Map<string, Map<string, CelluleSaisie>>()
    for (const p of lignesMois) {
      const nom = idToNom.get(p.consultant_id) as string
      let cellules = presencesParNom.get(nom)
      if (!cellules) {
        cellules = new Map()
        presencesParNom.set(nom, cellules)
      }
      cellules.set(p.date, statutPresenceEnCellule(p.statut))
    }

    // Roster = consultants actifs au Référentiel ∪ tout consultant ayant
    // réellement une présence ce mois (garde-fou anti-perte de donnée sur un
    // cas limite de fenêtre d'activité).
    const noms = new Set<string>()
    for (const c of consultants) {
      if (estActifCeMois(c, annee, moisNum)) noms.add(c.nom)
    }
    for (const nom of presencesParNom.keys()) noms.add(nom)

    // Tri alphabétique français : ordre déterministe et stable pour l'UI
    // (l'ordre des lignes n'a pas d'incidence sur les calculs KPI).
    const lignes: ConsultantMois[] = [...noms]
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((nom) => {
        const cellules = presencesParNom.get(nom)
        return {
          nom,
          jours: joursIso.map((iso, j) => ({
            date: joursOuvres[j],
            valeur: cellules?.get(iso) ?? null,
          })),
        }
      })

    mois[cle] = {
      cle,
      annee,
      mois: moisNum,
      joursOuvres,
      lignes,
      evenementsDuMois: evenements.filter(
        (e) =>
          e.date.getFullYear() === annee && e.date.getMonth() + 1 === moisNum,
      ),
    }
  }

  const cles = Object.keys(mois).sort()
  return { mois, cles }
}

/**
 * Construit la map de participations (`nom -> idSession -> 'F' | 'P'`) et, en
 * même temps, la liste des formateurs par session (dérivée du statut
 * 'formateur', absent de la table `sessions_formation`).
 */
function construireParticipations(
  participations: ParticipationRaw[],
  idToNom: Map<string, string>,
): {
  participationsFormations: ParticipationsFormation
  formateursParSession: Map<string, string[]>
} {
  const participationsFormations: ParticipationsFormation = new Map()
  const formateursSet = new Map<string, Set<string>>()

  for (const p of participations) {
    const nom = idToNom.get(p.consultant_id)
    if (!nom) continue // participation orpheline : ignorée

    let role: RoleFormation
    if (p.statut === "formateur") role = "F"
    else if (p.statut === "present") role = "P"
    else continue // 'inscrit' : non représenté dans RoleFormation

    let ligne = participationsFormations.get(nom)
    if (!ligne) {
      ligne = new Map()
      participationsFormations.set(nom, ligne)
    }
    ligne.set(p.session_id, role)

    if (role === "F") {
      let set = formateursSet.get(p.session_id)
      if (!set) {
        set = new Set()
        formateursSet.set(p.session_id, set)
      }
      set.add(nom)
    }
  }

  const formateursParSession = new Map<string, string[]>()
  for (const [sid, set] of formateursSet) {
    formateursParSession.set(
      sid,
      [...set].sort((a, b) => a.localeCompare(b, "fr")),
    )
  }

  return { participationsFormations, formateursParSession }
}

// === Fonction publique principale ===

export async function fetchDashboardData(): Promise<DashboardData> {
  const [
    consultantsRaw,
    sessions,
    evenements,
    presences,
    participations,
    feedbacksFormation,
  ] = await Promise.all([
    fetchConsultantsRaw(),
    fetchSessionsFormation(),
    fetchEvenements(),
    fetchPresences(),
    fetchParticipations(),
    fetchFeedbacks(),
  ])

  const consultants = consultantsRaw.map(mapConsultant)
  const idToNom = new Map(consultantsRaw.map((c) => [c.id, c.nom]))

  const { mois, cles } = construireMois(
    presences,
    consultants,
    idToNom,
    evenements,
  )
  const { participationsFormations, formateursParSession } =
    construireParticipations(participations, idToNom)

  const formations: SessionFormation[] = sessions.map((s) => ({
    ...s,
    formateurs: formateursParSession.get(s.idSession) ?? [],
  }))

  return {
    // Source live : la fraîcheur des données = instant du fetch.
    dateMiseAJour: new Date(),
    consultants,
    evenements,
    mois,
    cles,
    formations,
    participationsFormations,
    feedbacksFormation,
  }
}
