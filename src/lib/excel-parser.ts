import * as XLSX from "xlsx"
import type {
  CelluleSaisie,
  Consultant,
  ConsultantMois,
  DashboardData,
  Evenement,
  MoisData,
  MoisKey,
  PresenceJour,
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
  return parserBuffer(buffer)
}

export function parserBuffer(buffer: ArrayBuffer): DashboardData {
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

  return { consultants, evenements, mois, cles }
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
      dateEntree: estSerialDate(row[1]) ? serialEnDate(row[1]) : undefined,
      dateSortie: estSerialDate(row[2]) ? serialEnDate(row[2]) : undefined,
    })
  }
  return consultants
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
