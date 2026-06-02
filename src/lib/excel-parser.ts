import * as XLSX from "xlsx"
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
  PresenceJour,
  RoleConsultant,
  RoleFormation,
  SessionFormation,
} from "./types"

const URL_FICHIER_DEFAUT = "/data/suivi_presence_consultants.xlsx"
const REGEX_ONGLET_SAISIE = /^Saisie (\d{4})-(\d{2})$/

export async function chargerFichier(
  url: string = URL_FICHIER_DEFAUT,
): Promise<DashboardData> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Impossible de charger le fichier Excel : ${response.status} ${response.statusText}`,
    )
  }
  const buffer = await response.arrayBuffer()
  // Le header Last-Modified du xlsx statique reflète la date du dernier
  // déploiement (= dernier push). Absent ou invalide → null, sans fallback
  // sur la date du jour qui donnerait une fausse impression de fraîcheur.
  const dateMiseAJour = parserLastModified(response.headers.get("last-modified"))
  return parserBuffer(buffer, dateMiseAJour)
}

function parserLastModified(header: string | null): Date | null {
  if (!header) return null
  const d = new Date(header)
  return Number.isNaN(d.getTime()) ? null : d
}

export function parserBuffer(
  buffer: ArrayBuffer,
  dateMiseAJour: Date | null = null,
): DashboardData {
  const workbook = XLSX.read(buffer)

  const consultants = parserReferentiel(workbook.Sheets["Référentiel"])
  const evenements = parserEvenements(workbook.Sheets["Événements"])

  const mois: Record<MoisKey, MoisData> = {}
  const cles: MoisKey[] = []

  for (const nom of workbook.SheetNames) {
    if (!REGEX_ONGLET_SAISIE.test(nom)) continue
    const m = parserSaisieMois(workbook.Sheets[nom], nom)
    m.evenementsDuMois = filtrerEvenementsDuMois(evenements, m.annee, m.mois)
    mois[m.cle] = m
    cles.push(m.cle)
  }
  cles.sort()

  const formations = parserFormations(workbook.Sheets["Formations"])
  const participationsFormations = parserFormationsParticipations(
    workbook.Sheets["Formations_Participations"],
  )
  const feedbacksFormation = parserFormationFeedbacks(
    workbook.Sheets["Formation_Feedbacks"],
  )

  alerterFormateursInconnus(formations, consultants)

  return {
    dateMiseAJour,
    consultants,
    evenements,
    mois,
    cles,
    formations,
    participationsFormations,
    feedbacksFormation,
  }
}

function parserReferentiel(sheet: XLSX.WorkSheet | undefined): Consultant[] {
  if (!sheet) return []
  const rows = lireLignes(sheet)
  const headerIdx = rows.findIndex((r) => r[0] === "Consultant")
  if (headerIdx === -1) return []

  const consultants: Consultant[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const nom = row[0]
    if (nom == null || nom === "") continue
    consultants.push({
      nom: String(nom),
      dateEntree: estSerialDate(row[1]) ? serialEnDate(row[1]) : null,
      dateSortie: estSerialDate(row[2]) ? serialEnDate(row[2]) : null,
      role: normaliserRole(row[3]),
    })
  }
  return consultants
}

// Colonne D « Rôle » du Référentiel. Vide → 'consultant' (cas par défaut),
// « interne » (insensible à la casse et aux espaces) → 'interne'.
function normaliserRole(v: unknown): RoleConsultant {
  if (typeof v === "string" && v.trim().toLowerCase() === "interne") {
    return "interne"
  }
  return "consultant"
}

function parserEvenements(sheet: XLSX.WorkSheet | undefined): Evenement[] {
  if (!sheet) return []
  const rows = lireLignes(sheet)
  const headerIdx = rows.findIndex((r) => r[0] === "Date")
  if (headerIdx === -1) return []

  const evts: Evenement[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!estSerialDate(row[0])) continue
    evts.push({
      date: serialEnDate(row[0]),
      type: String(row[1] ?? ""),
      libelle: String(row[2] ?? ""),
    })
  }
  return evts
}

function parserSaisieMois(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): MoisData {
  const match = sheetName.match(REGEX_ONGLET_SAISIE)
  if (!match) throw new Error(`Nom d'onglet de saisie invalide : ${sheetName}`)
  const annee = Number(match[1])
  const mois = Number(match[2])
  const cle: MoisKey = `${match[1]}-${match[2]}`

  const rows = lireLignes(sheet)
  const headerIdx = rows.findIndex((r) => r[0] === "Consultant")
  if (headerIdx === -1) {
    throw new Error(`Ligne d'en-têtes introuvable dans ${sheetName}`)
  }
  const header = rows[headerIdx]

  const joursOuvres: Date[] = []
  for (let c = 1; c < header.length; c++) {
    const cell = header[c]
    if (estSerialDate(cell)) joursOuvres.push(serialEnDate(cell))
    else break // on a atteint "Total" ou "Statut OKR"
  }

  // Les lignes événements (« — Événements — », « XO Day », « XO Product Day »,
  // « Séminaire ») qui suivent les lignes consultants sont volontairement
  // ignorées. Source d'autorité pour les événements = onglet « Événements ».
  // Les croix X dans la grille sont parfois mal placées (sur la ligne titre
  // au lieu d'une ligne typée) et ne sont donc pas fiables.
  const lignes: ConsultantMois[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const nom = row[0]
    if (nom == null || nom === "") break
    const jours: PresenceJour[] = joursOuvres.map((date, j) => ({
      date,
      valeur: normaliserCellule(row[j + 1]),
    }))
    lignes.push({ nom: String(nom), jours })
  }

  return {
    cle,
    annee,
    mois,
    joursOuvres,
    lignes,
    evenementsDuMois: [], // rempli par parserBuffer après le parsing global
  }
}

function lireLignes(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
  })
}

// Convertit un serial Excel (jours depuis le 30 décembre 1899) en Date locale
// à midi. Passer par parse_date_code évite le drift de fuseau de cellDates:true.
function serialEnDate(serial: number): Date {
  const p = XLSX.SSF.parse_date_code(serial)
  return new Date(p.y, p.m - 1, p.d, 12, 0, 0)
}

function estSerialDate(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0
}

function normaliserCellule(v: unknown): CelluleSaisie {
  if (v === 1 || v === "1") return 1
  if (v === "IC") return "IC"
  if (v === "M") return "M"
  return null
}

function filtrerEvenementsDuMois(
  evts: Evenement[],
  annee: number,
  mois: number,
): Evenement[] {
  return evts.filter(
    (e) => e.date.getFullYear() === annee && e.date.getMonth() + 1 === mois,
  )
}

// === Formations ===

export function parserFormations(
  sheet: XLSX.WorkSheet | undefined,
): SessionFormation[] {
  if (!sheet) return []
  const rows = lireLignes(sheet)
  const headerIdx = rows.findIndex((r) => r[0] === "id_session")
  if (headerIdx === -1) return []

  const sessions: SessionFormation[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const id = row[0]
    if (id == null || id === "") continue
    if (!estSerialDate(row[1])) continue // ligne sans date valide → ignorée
    const formateurBrut = row[3] == null ? "" : String(row[3])
    const formateurs = formateurBrut
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    const lienBrut = row[4]
    sessions.push({
      idSession: String(id),
      date: serialEnDate(row[1] as number),
      thematique: String(row[2] ?? ""),
      formateurs,
      lienSupport:
        lienBrut == null || lienBrut === "" ? undefined : String(lienBrut),
    })
  }
  return sessions
}

export function parserFormationsParticipations(
  sheet: XLSX.WorkSheet | undefined,
): ParticipationsFormation {
  const result: ParticipationsFormation = new Map()
  if (!sheet) return result
  const rows = lireLignes(sheet)
  const headerIdx = rows.findIndex((r) => r[0] === "Consultant")
  if (headerIdx === -1) return result
  const header = rows[headerIdx]

  // Colonnes session : à partir de l'index 2 (col A = Consultant, B = Total).
  // On s'arrête à la première colonne nulle pour ignorer la queue vide.
  const colonnesSessions: { col: number; id: string }[] = []
  for (let c = 2; c < header.length; c++) {
    const cell = header[c]
    if (cell == null || cell === "") break
    colonnesSessions.push({ col: c, id: String(cell) })
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const nom = row[0]
    if (nom == null || nom === "") continue
    const participations = new Map<string, RoleFormation>()
    for (const { col, id } of colonnesSessions) {
      const v = row[col]
      if (v === "F" || v === "P") participations.set(id, v)
    }
    result.set(String(nom), participations)
  }
  return result
}

export function parserFormationFeedbacks(
  sheet: XLSX.WorkSheet | undefined,
): FeedbackFormation[] {
  // Backward-compat : si l'onglet n'a pas encore été ajouté au xlsx, on
  // renvoie un tableau vide plutôt que de planter. Le dashboard restera
  // utilisable sans la section Feedback.
  if (!sheet) return []
  const rows = lireLignes(sheet)
  const headerIdx = rows.findIndex((r) => r[0] === "id_response")
  if (headerIdx === -1) return []

  const result: FeedbackFormation[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const id = row[0]
    if (id == null || id === "") continue
    if (!estSerialDate(row[2])) continue
    const note = Number(row[3])
    if (!Number.isFinite(note)) continue
    result.push({
      idResponse: String(id),
      idSession: String(row[1] ?? ""),
      timestamp: serialEnDate(row[2] as number),
      noteGlobale: note,
      application: row[4] == null ? "" : String(row[4]),
      verbatimApprecie: row[5] == null ? "" : String(row[5]),
      verbatimAmelioration: row[6] == null ? "" : String(row[6]),
      verbatimCommentaire: row[7] == null ? "" : String(row[7]),
    })
  }
  return result
}

// Vérifie que tous les noms de formateurs déclarés dans l'onglet Formations
// existent au Référentiel. Permet de repérer les coquilles côté saisie.
function alerterFormateursInconnus(
  formations: SessionFormation[],
  consultants: Consultant[],
): void {
  const noms = new Set(consultants.map((c) => c.nom))
  const inconnus = new Set<string>()
  for (const f of formations) {
    for (const formateur of f.formateurs) {
      if (!noms.has(formateur)) inconnus.add(formateur)
    }
  }
  if (inconnus.size > 0) {
    console.warn(
      `[parser Formations] Formateurs absents du Référentiel : ${[...inconnus].join(", ")}`,
    )
  }
}
