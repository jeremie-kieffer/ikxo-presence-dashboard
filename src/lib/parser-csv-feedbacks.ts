// Parsing des exports CSV Google Forms de feedbacks de session.
// Zéro dépendance : parser CSV manuel (RFC 4180) + parser de timestamp GForms.
// Le mapping se fait par POSITION de colonne (6 colonnes fixes), pas par nom
// d'en-tête, pour être résilient aux variations orthographiques Google Forms.

export interface FeedbackParsed {
  id: string
  session_id: string
  timestamp: string // ISO 8601
  note_globale: number
  application: string
  verbatim_apprecie: string
  verbatim_amelioration: string
  verbatim_commentaire: string
}

export interface LigneInvalide {
  ligne: number // n° de ligne de données (1-based)
  raison: string
  apercu: string
}

export interface ResultatParsing {
  valides: FeedbackParsed[]
  invalides: LigneInvalide[]
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Parse un timestamp Google Forms "2026/07/29 3:08:24 PM UTC+3" en ISO 8601
 * "2026-07-29T15:08:24+03:00". Retourne null si le format est inattendu, l'heure
 * hors bornes, ou le fuseau non parsable.
 */
export function parseTimestampGForms(s: string): string | null {
  const m = s
    .trim()
    .match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+UTC([+-]\d{1,2})(?::?(\d{2}))?$/i,
    )
  if (!m) return null

  const annee = m[1]
  const mois = Number(m[2])
  const jour = Number(m[3])
  let heure = Number(m[4])
  const minute = Number(m[5])
  const seconde = Number(m[6])
  const ampm = m[7].toUpperCase()
  const offSigne = m[8][0]
  const offHeures = Number(m[8].slice(1))
  const offMinutes = m[9] ? Number(m[9]) : 0

  if (heure < 1 || heure > 12) return null
  if (ampm === "PM") {
    if (heure !== 12) heure += 12
  } else if (heure === 12) {
    heure = 0
  }

  if (
    mois < 1 || mois > 12 ||
    jour < 1 || jour > 31 ||
    minute > 59 || seconde > 59 ||
    offHeures > 14 || offMinutes > 59
  ) {
    return null
  }

  const tz = `${offSigne}${pad2(offHeures)}:${pad2(offMinutes)}`
  return `${annee}-${pad2(mois)}-${pad2(jour)}T${pad2(heure)}:${pad2(minute)}:${pad2(seconde)}${tz}`
}

// Parser CSV RFC 4180 : gère guillemets, virgules et retours ligne dans les
// champs, ainsi que les guillemets échappés ("").
function parserCSV(texte: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let champ = ""
  let dansGuillemets = false
  let i = 0
  const n = texte.length

  while (i < n) {
    const c = texte[i]
    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"'
          i += 2
          continue
        }
        dansGuillemets = false
        i++
        continue
      }
      champ += c
      i++
      continue
    }
    if (c === '"') {
      dansGuillemets = true
      i++
      continue
    }
    if (c === ",") {
      row.push(champ)
      champ = ""
      i++
      continue
    }
    if (c === "\r") {
      i++
      continue
    }
    if (c === "\n") {
      row.push(champ)
      rows.push(row)
      row = []
      champ = ""
      i++
      continue
    }
    champ += c
    i++
  }
  if (champ.length > 0 || row.length > 0) {
    row.push(champ)
    rows.push(row)
  }
  return rows
}

const NB_COLONNES = 6

/**
 * Parse un CSV Google Forms de feedbacks pour une session donnée.
 * Rejette (throw) le fichier entier si : en-tête ≠ 6 colonnes, aucune ligne de
 * données, ou timestamp illisible sur TOUTES les lignes.
 * Sinon retourne { valides, invalides } — une ligne invalide (note ou timestamp)
 * est comptabilisée mais n'interrompt pas le reste.
 */
export function parserCSVFeedbacks(
  csv: string,
  sessionId: string,
): ResultatParsing {
  const rows = parserCSV(csv)
  if (rows.length === 0) {
    throw new Error("Fichier vide.")
  }
  const enTete = rows[0]
  if (enTete.length !== NB_COLONNES) {
    throw new Error(
      `En-tête à ${enTete.length} colonne(s) au lieu de ${NB_COLONNES}. Ce n'est pas un export Google Forms de feedbacks.`,
    )
  }

  const lignesData = rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
  if (lignesData.length === 0) {
    throw new Error("Aucune ligne de données dans le fichier.")
  }

  const valides: FeedbackParsed[] = []
  const invalides: LigneInvalide[] = []
  let echecsTimestamp = 0

  lignesData.forEach((cells, idx) => {
    const ligne = idx + 1
    const brut = (cells[0] ?? "").trim()
    const tsIso = parseTimestampGForms(cells[0] ?? "")
    if (!tsIso) {
      echecsTimestamp++
      invalides.push({ ligne, raison: "Horodateur illisible", apercu: brut })
      return
    }
    const note = Number((cells[1] ?? "").trim())
    if (!Number.isInteger(note) || note < 1 || note > 5) {
      invalides.push({
        ligne,
        raison: `Note invalide (« ${(cells[1] ?? "").trim()} »)`,
        apercu: brut,
      })
      return
    }
    valides.push({
      id: `${sessionId}_${tsIso}`,
      session_id: sessionId,
      timestamp: tsIso,
      note_globale: note,
      application: (cells[2] ?? "").trim(),
      verbatim_apprecie: (cells[3] ?? "").trim(),
      verbatim_amelioration: (cells[4] ?? "").trim(),
      verbatim_commentaire: (cells[5] ?? "").trim(),
    })
  })

  if (echecsTimestamp === lignesData.length) {
    throw new Error(
      "Horodateur illisible sur toutes les lignes : le format du fichier ne correspond pas à un export Google Forms.",
    )
  }

  return { valides, invalides }
}
