// Refonte ergonomique des onglets « Saisie YYYY-MM » du fichier source.
// Préserve strictement les données ; régénère uniquement la mise en forme.
// Les autres onglets (Convention, Référentiel, Événements, Log, Synthèses)
// sont laissés intacts.
//
// Usage : node scripts/refondre-excel.mjs

import ExcelJS from "exceljs"
import { resolve } from "node:path"

const FICHIER = resolve("public/data/suivi_presence_consultants.xlsx")

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

const COULEURS = {
  un: "FFD1FAE5",         // 1   → vert clair
  ic: "FFFEF3C7",         // IC  → jaune clair
  m: "FFE5E7EB",          // M   → gris clair
  x: "FFE9D5FF",          // X   → violet clair
  enteteFond: "FFF3F4F6", // ligne 3 (en-têtes)
  weekend: "FFF9FAFB",    // pas utilisé (on filtre déjà aux jours ouvrés)
  bordureSemaine: "FF9CA3AF",
}

const POLICE = { name: "Inter", size: 11 }
const POLICE_GRAS = { name: "Inter", size: 12, bold: true }
const POLICE_TITRE = { name: "Inter", size: 14, bold: true }

// Tri par nom de famille (dernier mot du nom complet).
function cleNomFamille(nomComplet) {
  const parts = nomComplet.trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase()
}

function colonneExcel(idx1) {
  // 1 → A, 2 → B, ..., 27 → AA
  let n = idx1
  let s = ""
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function serialEnDateUtc(serial) {
  // Identique à la conversion utilisée par le parser : on récupère y/m/d
  // depuis le serial Excel via la table SSF, puis on construit une Date à midi
  // pour éviter tout drift de fuseau.
  const epoch = new Date(Date.UTC(1899, 11, 30))
  const ms = serial * 86400 * 1000
  const d = new Date(epoch.getTime() + ms)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
}

function extraireDonneesOnglet(ws) {
  // Lit l'onglet Saisie tel qu'il est et renvoie une structure neutre :
  // { titre, joursOuvres: Date[], lignes: [{ nom, valeurs: (1|"IC"|"M"|null)[] }] }
  const titre = ws.getRow(1).getCell(1).value
  const headerRow = ws.getRow(3)

  const joursOuvres = []
  let totalCol = -1
  for (let c = 2; c <= headerRow.cellCount; c++) {
    const v = headerRow.getCell(c).value
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      joursOuvres.push({ col: c, date: serialEnDateUtc(v), serial: v })
    } else if (v === "Total") {
      totalCol = c
      break
    } else if (v == null || v === "") {
      // colonne vide entre dates → ne devrait pas arriver dans l'ancien fichier
      break
    } else {
      break
    }
  }

  const lignes = []
  for (let r = 4; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const nom = row.getCell(1).value
    if (nom == null || nom === "") break
    const valeurs = joursOuvres.map(({ col }) => {
      const v = row.getCell(col).value
      if (v === 1 || v === "1") return 1
      if (v === "IC") return "IC"
      if (v === "M") return "M"
      return null
    })
    lignes.push({ nom: String(nom), valeurs })
  }

  return { titre: String(titre ?? ""), joursOuvres, lignes }
}

function extraireEvenements(workbook) {
  // Renvoie [{ date: Date, type: string }] depuis l'onglet Événements.
  const ws = workbook.getWorksheet("Événements")
  if (!ws) return []
  const evts = []
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const v = row.getCell(1).value
    if (typeof v === "number" && v > 0) {
      evts.push({
        date: serialEnDateUtc(v),
        serial: v,
        type: String(row.getCell(2).value ?? ""),
      })
    }
  }
  return evts
}

function regenererOnglet(workbook, nomOnglet, donnees, evenements) {
  // Supprime puis recrée l'onglet à l'index d'origine.
  const ancien = workbook.getWorksheet(nomOnglet)
  const orderNo = ancien.orderNo ?? workbook.worksheets.indexOf(ancien)
  workbook.removeWorksheet(ancien.id)

  const ws = workbook.addWorksheet(nomOnglet, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 3 }],
  })
  // Repositionner l'onglet à son index d'origine.
  if (typeof orderNo === "number" && orderNo >= 0) {
    ws.orderNo = orderNo
  }

  const { joursOuvres, lignes } = donnees
  const nbJours = joursOuvres.length

  // ── Largeurs de colonnes ───────────────────────────────────────────────
  ws.getColumn(1).width = 26
  for (let i = 0; i < nbJours; i++) ws.getColumn(2 + i).width = 8
  ws.getColumn(2 + nbJours).width = 8       // Total
  ws.getColumn(3 + nbJours).width = 18      // Statut OKR

  // ── Ligne 1 : titre ────────────────────────────────────────────────────
  const [annee, mois] = nomOnglet.match(/(\d{4})-(\d{2})$/).slice(1, 3).map(Number)
  const titre = `Saisie présence — ${MOIS_FR[mois - 1]} ${annee}`
  const cTitre = ws.getCell(1, 1)
  cTitre.value = titre
  cTitre.font = POLICE_TITRE
  ws.mergeCells(1, 1, 1, 3 + nbJours)
  ws.getRow(1).height = 22

  // ── Ligne 3 : en-têtes ────────────────────────────────────────────────
  const headerRow = ws.getRow(3)
  headerRow.height = 22

  const cellConsultant = headerRow.getCell(1)
  cellConsultant.value = "Consultant"
  cellConsultant.font = POLICE_GRAS
  cellConsultant.alignment = { vertical: "middle", horizontal: "left" }
  cellConsultant.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: COULEURS.enteteFond },
  }
  cellConsultant.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } }

  for (let i = 0; i < nbJours; i++) {
    const { date, serial } = joursOuvres[i]
    const cell = headerRow.getCell(2 + i)
    cell.value = serial // on garde le serial Excel — le parser le lit via numFmt-agnostique
    cell.numFmt = "[$-040C]ddd dd"
    cell.font = POLICE_GRAS
    cell.alignment = { vertical: "middle", horizontal: "center" }
    cell.fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: COULEURS.enteteFond },
    }
    const border = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    }
    // Bordure gauche épaisse sur chaque lundi (sauf la 1re colonne de la grille).
    if (date.getDay() === 1 && i > 0) {
      border.left = { style: "medium", color: { argb: COULEURS.bordureSemaine } }
    }
    cell.border = border
  }

  const cellTotal = headerRow.getCell(2 + nbJours)
  cellTotal.value = "Total"
  cellTotal.font = POLICE_GRAS
  cellTotal.alignment = { vertical: "middle", horizontal: "center" }
  cellTotal.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: COULEURS.enteteFond },
  }
  cellTotal.border = {
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "medium", color: { argb: COULEURS.bordureSemaine } },
  }

  const cellStatut = headerRow.getCell(3 + nbJours)
  cellStatut.value = "Statut OKR"
  cellStatut.font = POLICE_GRAS
  cellStatut.alignment = { vertical: "middle", horizontal: "center" }
  cellStatut.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: COULEURS.enteteFond },
  }
  cellStatut.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } }

  // ── Lignes consultants (triées par nom de famille) ────────────────────
  const lignesTriees = [...lignes].sort((a, b) =>
    cleNomFamille(a.nom).localeCompare(cleNomFamille(b.nom), "fr"),
  )

  const premiereLigneCons = 4
  for (let i = 0; i < lignesTriees.length; i++) {
    const r = premiereLigneCons + i
    const { nom, valeurs } = lignesTriees[i]
    const row = ws.getRow(r)
    row.height = 18

    const cellNom = row.getCell(1)
    cellNom.value = nom
    cellNom.font = POLICE
    cellNom.alignment = { vertical: "middle", horizontal: "left" }

    for (let j = 0; j < nbJours; j++) {
      const cell = row.getCell(2 + j)
      const v = valeurs[j]
      if (v != null) cell.value = v
      cell.font = POLICE
      cell.alignment = { vertical: "middle", horizontal: "center" }
      // Mise en forme directe selon la valeur saisie.
      if (v === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COULEURS.un } }
      } else if (v === "IC") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COULEURS.ic } }
      } else if (v === "M") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COULEURS.m } }
      }
      // Bordure semaine cohérente avec l'en-tête.
      const date = joursOuvres[j].date
      if (date.getDay() === 1 && j > 0) {
        cell.border = { left: { style: "medium", color: { argb: COULEURS.bordureSemaine } } }
      }
    }

    // Total (formule Excel : nombre de 1 + nombre de IC)
    const colDeb = colonneExcel(2)
    const colFin = colonneExcel(1 + nbJours)
    const cellTot = row.getCell(2 + nbJours)
    cellTot.value = {
      formula: `COUNTIF(${colDeb}${r}:${colFin}${r},1)+COUNTIF(${colDeb}${r}:${colFin}${r},"IC")`,
    }
    cellTot.font = POLICE_GRAS
    cellTot.alignment = { vertical: "middle", horizontal: "center" }
    cellTot.border = { left: { style: "medium", color: { argb: COULEURS.bordureSemaine } } }

    // Statut OKR (M → N/A ; sinon Total ≥ 2 → Atteint, sinon Sous objectif)
    const cellSt = row.getCell(3 + nbJours)
    cellSt.value = {
      formula: `IF(COUNTIF(${colDeb}${r}:${colFin}${r},"M")>0,"N/A absence longue",IF(${colonneExcel(2 + nbJours)}${r}>=2,"Atteint","Sous objectif"))`,
    }
    cellSt.font = POLICE
    cellSt.alignment = { vertical: "middle", horizontal: "center" }
  }

  // ── Section événements ────────────────────────────────────────────────
  const ligneSep = premiereLigneCons + lignesTriees.length + 1 // une ligne vide
  const ligneXoDay = ligneSep + 1
  const ligneXoProductDay = ligneSep + 2
  const ligneSeminaire = ligneSep + 3

  const cellSepLabel = ws.getCell(ligneSep, 1)
  cellSepLabel.value = "— Événements —"
  cellSepLabel.font = { ...POLICE_GRAS, color: { argb: "FF6B7280" } }

  const placerEvt = (ligne, libelle) => {
    const row = ws.getRow(ligne)
    row.getCell(1).value = libelle
    row.getCell(1).font = POLICE_GRAS
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" }
    for (let j = 0; j < nbJours; j++) {
      const cell = row.getCell(2 + j)
      const date = joursOuvres[j].date
      const evt = evenements.find(
        (e) => e.type === libelle &&
          e.date.getFullYear() === date.getFullYear() &&
          e.date.getMonth() === date.getMonth() &&
          e.date.getDate() === date.getDate(),
      )
      if (evt) {
        cell.value = "X"
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COULEURS.x } }
      }
      cell.font = POLICE
      cell.alignment = { vertical: "middle", horizontal: "center" }
      if (date.getDay() === 1 && j > 0) {
        cell.border = { left: { style: "medium", color: { argb: COULEURS.bordureSemaine } } }
      }
    }
  }

  placerEvt(ligneXoDay, "XO Day")
  placerEvt(ligneXoProductDay, "XO Product Day")
  placerEvt(ligneSeminaire, "Séminaire")

  // ── Validations de saisie (dropdowns) ─────────────────────────────────
  const colDeb = colonneExcel(2)
  const colFin = colonneExcel(1 + nbJours)
  const refConsultants = `${colDeb}${premiereLigneCons}:${colFin}${premiereLigneCons + lignesTriees.length - 1}`
  const refEvenements = `${colDeb}${ligneXoDay}:${colFin}${ligneSeminaire}`

  ws.dataValidations.add(refConsultants, {
    type: "list",
    allowBlank: true,
    formulae: ['"1,IC,M"'],
    showErrorMessage: true,
    errorTitle: "Valeur invalide",
    error: "Valeurs autorisées : 1, IC, M ou vide.",
  })
  ws.dataValidations.add(refEvenements, {
    type: "list",
    allowBlank: true,
    formulae: ['"X"'],
    showErrorMessage: true,
    errorTitle: "Valeur invalide",
    error: "Valeurs autorisées : X ou vide.",
  })

  // ── Mise en forme conditionnelle (futures saisies) ────────────────────
  const cf = (formule, argb) => ({
    type: "containsText",
    operator: "containsText",
    text: formule,
    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb } } },
  })
  // ExcelJS — règles cellIs pour valeurs exactes
  const regleCellIs = (operator, formulae, argb, priority) => ({
    type: "cellIs",
    operator,
    formulae,
    priority,
    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb } } },
  })

  ws.addConditionalFormatting({
    ref: refConsultants,
    rules: [
      regleCellIs("equal", ["1"], COULEURS.un, 1),
      regleCellIs("equal", ['"IC"'], COULEURS.ic, 2),
      regleCellIs("equal", ['"M"'], COULEURS.m, 3),
    ],
  })
  ws.addConditionalFormatting({
    ref: refEvenements,
    rules: [
      regleCellIs("equal", ['"X"'], COULEURS.x, 1),
    ],
  })
  void cf // (helper non utilisé : on reste sur cellIs strict)
}

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FICHIER)

  const evenements = extraireEvenements(wb)
  console.log(`→ ${evenements.length} événements détectés`)

  const onglets = wb.worksheets
    .map((ws) => ws.name)
    .filter((n) => /^Saisie \d{4}-\d{2}$/.test(n))
  console.log(`→ onglets à régénérer : ${onglets.join(", ")}`)

  // On extrait toutes les données AVANT toute modification, pour éviter
  // qu'une suppression d'onglet décale les références.
  const donneesParOnglet = {}
  for (const nom of onglets) {
    donneesParOnglet[nom] = extraireDonneesOnglet(wb.getWorksheet(nom))
    console.log(
      `  ${nom} : ${donneesParOnglet[nom].joursOuvres.length} jours, ${donneesParOnglet[nom].lignes.length} consultants`,
    )
  }

  for (const nom of onglets) {
    regenererOnglet(wb, nom, donneesParOnglet[nom], evenements)
    console.log(`  ✓ ${nom} régénéré`)
  }

  await wb.xlsx.writeFile(FICHIER)
  console.log(`✓ Fichier écrit : ${FICHIER}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
