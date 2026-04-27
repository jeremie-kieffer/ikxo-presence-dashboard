import type {
  ConsultantMois,
  DashboardData,
  Evenement,
  MoisData,
  MoisKey,
  PresenceJour,
  StatutOKR,
} from "./types"

// === Briques unitaires (sur une ligne ConsultantMois) ===

export function compterPresences(jours: PresenceJour[]): number {
  return jours.filter((j) => j.valeur === 1 || j.valeur === "IC").length
}

export function compterIC(jours: PresenceJour[]): number {
  return jours.filter((j) => j.valeur === "IC").length
}

export function calculerStatutOKR(jours: PresenceJour[]): StatutOKR {
  if (jours.some((j) => j.valeur === "M")) return "absence_longue"
  return compterPresences(jours) >= 2 ? "atteint" : "sous_objectif"
}

// === Filtres au niveau mois ===

export function lignesActives(mois: MoisData): ConsultantMois[] {
  return mois.lignes.filter(
    (l) => calculerStatutOKR(l.jours) !== "absence_longue",
  )
}

// === KPI cabinet ===

export function nbActifs(mois: MoisData): number {
  return lignesActives(mois).length
}

export function tauxAtteinte(mois: MoisData): number {
  const actifs = lignesActives(mois)
  if (actifs.length === 0) return 0
  const atteint = actifs.filter(
    (l) => calculerStatutOKR(l.jours) === "atteint",
  ).length
  return atteint / actifs.length
}

export function presenceMoyenne(mois: MoisData): number {
  const actifs = lignesActives(mois)
  if (actifs.length === 0) return 0
  const total = actifs.reduce((acc, l) => acc + compterPresences(l.jours), 0)
  return total / actifs.length
}

export function nbVenusAuMoinsUneFois(mois: MoisData): number {
  return lignesActives(mois).filter((l) => compterPresences(l.jours) >= 1)
    .length
}

export function nbSousObjectif(mois: MoisData): number {
  return lignesActives(mois).filter(
    (l) => calculerStatutOKR(l.jours) === "sous_objectif",
  ).length
}

export function nbJamaisVenus(mois: MoisData): number {
  return lignesActives(mois).filter((l) => compterPresences(l.jours) === 0)
    .length
}

// Présences cumulées (1 + IC, toutes lignes) divisées par le nb de jours
// ouvrés. Mesure la fréquentation tangible des bureaux, neutralisée du nb
// de jours du mois.
export function presenceMoyenneParJourTous(mois: MoisData): number {
  if (mois.joursOuvres.length === 0) return 0
  let total = 0
  for (const ligne of mois.lignes) {
    total += compterPresences(ligne.jours)
  }
  return total / mois.joursOuvres.length
}

// Variante excluant les consultants en intercontrat (ceux ayant au moins
// une cellule 'IC' dans le mois). Lit la fréquentation des consultants
// "en mission", dont l'attendu OKR est ≥2j/mois, sans la dilution des
// intercontrats attendus 3j/semaine.
export function presenceMoyenneParJourHorsIntercontrat(
  mois: MoisData,
): number {
  if (mois.joursOuvres.length === 0) return 0
  let total = 0
  for (const ligne of mois.lignes) {
    const aIC = ligne.jours.some((j) => j.valeur === "IC")
    if (aIC) continue
    total += ligne.jours.filter((j) => j.valeur === 1).length
  }
  return total / mois.joursOuvres.length
}

// === Pic du mois ===

export interface PicJour {
  date: Date
  total: number
  evenement?: Evenement
}

export function picDuMois(mois: MoisData): PicJour {
  // Mesure de fréquentation : on compte sur TOUTES les lignes, pas seulement
  // les actives. Les M ne génèrent pas de présence donc n'ont pas d'impact.
  let pic: PicJour = { date: mois.joursOuvres[0], total: 0 }
  for (let idx = 0; idx < mois.joursOuvres.length; idx++) {
    let total = 0
    for (const ligne of mois.lignes) {
      const v = ligne.jours[idx].valeur
      if (v === 1 || v === "IC") total++
    }
    if (total > pic.total) {
      pic = { date: mois.joursOuvres[idx], total }
    }
  }
  pic.evenement = mois.evenementsDuMois.find((e) => memeJour(e.date, pic.date))
  return pic
}

function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// === Agrégations pour les graphiques ===

export interface Distribution {
  "0": number
  "1": number
  "2": number
  "3": number
  "4": number
  "5+": number
}

export function distributionPresences(mois: MoisData): Distribution {
  // Sur les actifs : un consultant en absence longue n'a pas de profil OKR
  // significatif et fausserait la lecture de la distribution.
  const result: Distribution = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5+": 0 }
  for (const l of lignesActives(mois)) {
    const n = compterPresences(l.jours)
    if (n === 0) result["0"]++
    else if (n === 1) result["1"]++
    else if (n === 2) result["2"]++
    else if (n === 3) result["3"]++
    else if (n === 4) result["4"]++
    else result["5+"]++
  }
  return result
}

export interface PresenceJourSemaine {
  lundi: number
  mardi: number
  mercredi: number
  jeudi: number
  vendredi: number
}

export function presenceParJourSemaine(mois: MoisData): PresenceJourSemaine {
  const result: PresenceJourSemaine = {
    lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0,
  }
  const cles: (keyof PresenceJourSemaine)[] = [
    "lundi", "mardi", "mercredi", "jeudi", "vendredi",
  ]
  // Mesure de fréquentation : on compte sur toutes les lignes.
  for (const ligne of mois.lignes) {
    for (const j of ligne.jours) {
      if (j.valeur !== 1 && j.valeur !== "IC") continue
      const dow = j.date.getDay() // 0=dim, 1-5=lun-ven, 6=sam
      if (dow >= 1 && dow <= 5) result[cles[dow - 1]]++
    }
  }
  return result
}

// === Détail consultant (multi-mois) ===

export function historiqueConsultant(
  data: DashboardData,
  nom: string,
  jusquA: MoisKey,
  nbMois: number,
): StatutOKR[] {
  const idx = data.cles.indexOf(jusquA)
  if (idx === -1) return []
  const debut = Math.max(0, idx - nbMois + 1)
  return data.cles.slice(debut, idx + 1).map((cle) => {
    const ligne = data.mois[cle]?.lignes.find((l) => l.nom === nom)
    if (!ligne) return "absence_longue"
    return calculerStatutOKR(ligne.jours)
  })
}

export function estARisque3Mois(historique: StatutOKR[]): boolean {
  // 3 derniers mois (hors absence_longue) tous en 'sous_objectif'
  const filtres = historique.filter((s) => s !== "absence_longue")
  const trois = filtres.slice(-3)
  return trois.length === 3 && trois.every((s) => s === "sous_objectif")
}

// === Helpers inter-mois ===

export function moisPrecedent(
  cles: MoisKey[],
  cle: MoisKey,
): MoisKey | null {
  const idx = cles.indexOf(cle)
  return idx > 0 ? cles[idx - 1] : null
}

// === Détection d'incohérences (santé du fichier) ===

export interface Incoherence {
  mois: MoisKey
  consultant: string
  type: "absent_de_saisie" | "saisi_hors_referentiel"
}

export function detecterIncoherences(data: DashboardData): Incoherence[] {
  const result: Incoherence[] = []
  const nomsReferentiel = new Set(data.consultants.map((c) => c.nom))

  for (const cle of data.cles) {
    const m = data.mois[cle]
    const nomsSaisis = new Set(m.lignes.map((l) => l.nom))

    for (const nom of nomsSaisis) {
      if (!nomsReferentiel.has(nom)) {
        result.push({ mois: cle, consultant: nom, type: "saisi_hors_referentiel" })
      }
    }

    for (const c of data.consultants) {
      if (nomsSaisis.has(c.nom)) continue
      // Si dateEntree est postérieure à ce mois, le consultant n'était pas
      // encore arrivé : ce n'est pas une incohérence.
      if (c.dateEntree && estPosterieurAuMois(c.dateEntree, m.annee, m.mois)) continue
      // Idem si dateSortie est antérieure.
      if (c.dateSortie && estAnterieurAuMois(c.dateSortie, m.annee, m.mois)) continue
      result.push({ mois: cle, consultant: c.nom, type: "absent_de_saisie" })
    }
  }
  return result
}

function estPosterieurAuMois(d: Date, annee: number, mois: number): boolean {
  const a = d.getFullYear()
  const m = d.getMonth() + 1
  return a > annee || (a === annee && m > mois)
}

function estAnterieurAuMois(d: Date, annee: number, mois: number): boolean {
  const a = d.getFullYear()
  const m = d.getMonth() + 1
  return a < annee || (a === annee && m < mois)
}

// === Vue trimestrielle ===

export interface Trimestre {
  annee: number
  numero: number // 1-4
}

export function trimestreDuMois(cle: MoisKey): Trimestre {
  const [a, m] = cle.split("-").map(Number)
  return { annee: a, numero: Math.ceil(m / 3) }
}

export function clesDuTrimestre(
  cles: MoisKey[],
  annee: number,
  trimestre: number,
): MoisKey[] {
  const moisDebut = (trimestre - 1) * 3 + 1
  const moisFin = trimestre * 3
  return cles.filter((cle) => {
    const [a, m] = cle.split("-").map(Number)
    return a === annee && m >= moisDebut && m <= moisFin
  })
}

export function tauxAtteinteTrimestre(
  data: DashboardData,
  cles: MoisKey[],
): number {
  if (cles.length === 0) return 0
  const taux = cles.map((cle) => tauxAtteinte(data.mois[cle]))
  return taux.reduce((a, b) => a + b, 0) / taux.length
}

// Consultants atteints CHAQUE mois du trimestre / consultants présents et
// actifs (hors absence longue) sur tous ces mois. Un consultant en absence
// longue ou absent du référentiel sur un mois est exclu du dénominateur —
// sinon les nouveaux arrivants ou retours de congé fausseraient la régularité.
// Retourne la fraction { atteints, total } pour un affichage absolu.
export function consultantsReguliersTrimestre(
  data: DashboardData,
  cles: MoisKey[],
): { atteints: number; total: number } {
  if (cles.length === 0) return { atteints: 0, total: 0 }
  const tousLesNoms = new Set<string>()
  for (const cle of cles) {
    for (const ligne of data.mois[cle].lignes) tousLesNoms.add(ligne.nom)
  }
  const actifsSurTout: string[] = []
  for (const nom of tousLesNoms) {
    const actifPartout = cles.every((cle) => {
      const ligne = data.mois[cle].lignes.find((l) => l.nom === nom)
      return ligne && calculerStatutOKR(ligne.jours) !== "absence_longue"
    })
    if (actifPartout) actifsSurTout.push(nom)
  }
  const atteintsPartout = actifsSurTout.filter((nom) =>
    cles.every((cle) => {
      const ligne = data.mois[cle].lignes.find((l) => l.nom === nom)
      return ligne != null && calculerStatutOKR(ligne.jours) === "atteint"
    }),
  )
  return { atteints: atteintsPartout.length, total: actifsSurTout.length }
}

export function picTrimestre(
  data: DashboardData,
  cles: MoisKey[],
): PicJour {
  let pic: PicJour = { date: new Date(0), total: 0 }
  for (const cle of cles) {
    const p = picDuMois(data.mois[cle])
    if (p.total > pic.total) pic = p
  }
  return pic
}

// Noms des consultants en sous_objectif sur TOUS les mois du trimestre
// (et présents sur tous ces mois, c.-à-d. jamais en absence longue).
export function alertesRecurrentesTrimestre(
  data: DashboardData,
  cles: MoisKey[],
): string[] {
  if (cles.length === 0) return []
  const tousLesNoms = new Set<string>()
  for (const cle of cles) {
    for (const ligne of data.mois[cle].lignes) tousLesNoms.add(ligne.nom)
  }
  const alertes: string[] = []
  for (const nom of tousLesNoms) {
    const sousObjPartout = cles.every((cle) => {
      const ligne = data.mois[cle].lignes.find((l) => l.nom === nom)
      return ligne != null && calculerStatutOKR(ligne.jours) === "sous_objectif"
    })
    if (sousObjPartout) alertes.push(nom)
  }
  return alertes.sort((a, b) => a.localeCompare(b, "fr"))
}

export function evolutionTauxAtteinte(
  data: DashboardData,
): { cle: MoisKey; taux: number }[] {
  return data.cles.map((cle) => ({
    cle,
    taux: tauxAtteinte(data.mois[cle]),
  }))
}
