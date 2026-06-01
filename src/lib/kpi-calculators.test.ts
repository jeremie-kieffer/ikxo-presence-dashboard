import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parserBuffer } from "./excel-parser"
import {
  alertesRecurrentesTrimestre,
  calculerStatutOKR,
  clesDuTrimestre,
  computeFormationKPIs,
  compterPresences,
  consultantsReguliersTrimestre,
  detecterIncoherences,
  distributionPresences,
  estARisque3Mois,
  evolutionTauxAtteinte,
  filtrerSessions,
  historiqueConsultant,
  moisPrecedent,
  nbActifs,
  nbJamaisVenus,
  nbSousObjectif,
  nbVenusAuMoinsUneFois,
  picDuMois,
  presenceMoyenne,
  presenceMoyenneParJourHorsIntercontrat,
  presenceMoyenneParJourTous,
  presenceParJourSemaine,
  tauxAtteinte,
  tauxAtteinteTrimestre,
  trimestreDuMois,
} from "./kpi-calculators"
import type { PresenceJour } from "./types"

const buf = readFileSync(
  resolve(__dirname, "../../public/data/suivi_presence_consultants.xlsx"),
)
const arrayBuffer = buf.buffer.slice(
  buf.byteOffset,
  buf.byteOffset + buf.byteLength,
) as ArrayBuffer
const data = parserBuffer(arrayBuffer)

const d = (jour: number) => new Date(2026, 3, jour, 12) // helper avril
const mkJour = (valeur: PresenceJour["valeur"]): PresenceJour => ({
  date: d(1),
  valeur,
})

describe("briques unitaires", () => {
  it("compterPresences : compte 1 et IC, ignore null et M", () => {
    expect(
      compterPresences([
        mkJour(1),
        mkJour("IC"),
        mkJour(null),
        mkJour("M"),
      ]),
    ).toBe(2)
  })

  it("calculerStatutOKR : un seul M domine tout le reste", () => {
    expect(calculerStatutOKR([mkJour(1), mkJour(1), mkJour("M")])).toBe(
      "absence_longue",
    )
  })

  it("calculerStatutOKR : ≥2 présences → atteint", () => {
    expect(calculerStatutOKR([mkJour(1), mkJour("IC")])).toBe("atteint")
  })

  it("calculerStatutOKR : <2 présences → sous_objectif", () => {
    expect(calculerStatutOKR([mkJour(1), mkJour(null)])).toBe("sous_objectif")
  })
})

// Valeurs alignées sur la donnée d'avril telle qu'enrichie au
// commit 1b1023d (refonte ergonomique). Le test était stale
// depuis cette refonte ; il avait été écrit sur la donnée
// initiale (69/47). Mettre à jour ce bloc si la donnée
// d'avril évolue à nouveau.
describe("avril 2026 — KPI cabinet", () => {
  const m = data.mois["2026-04"]

  it("26 actifs (Zelal en IC, donc active)", () => {
    expect(nbActifs(m)).toBe(26)
  })

  it("taux d'atteinte ≈ 85% (22 atteints / 26 actifs)", () => {
    expect(tauxAtteinte(m)).toBeCloseTo(22 / 26, 5)
  })

  it("présence moyenne ≈ 3.15j (82 présences / 26 actifs)", () => {
    expect(presenceMoyenne(m)).toBeCloseTo(82 / 26, 2)
  })

  it("nbSousObjectif + nbAtteint = nbActifs", () => {
    const atteint = nbActifs(m) - nbSousObjectif(m)
    expect(atteint).toBe(22)
    expect(nbSousObjectif(m)).toBe(4)
  })

  it("nbVenusAuMoinsUneFois = 26 (tout le monde est venu au moins 1x en avril)", () => {
    expect(nbVenusAuMoinsUneFois(m)).toBe(26)
    expect(nbJamaisVenus(m)).toBe(0)
  })

  it("présence moyenne par jour (tous) ≈ 3.73 (82 présences / 22 jours ouvrés)", () => {
    expect(presenceMoyenneParJourTous(m)).toBeCloseTo(82 / 22, 2)
  })

  it("présence moyenne par jour (hors IC) ≈ 2.45 (54 présences '1' / 22 jours)", () => {
    expect(presenceMoyenneParJourHorsIntercontrat(m)).toBeCloseTo(54 / 22, 3)
  })

  it("hors intercontrat ≤ tous (par construction)", () => {
    expect(presenceMoyenneParJourHorsIntercontrat(m)).toBeLessThanOrEqual(
      presenceMoyenneParJourTous(m),
    )
  })
})

describe("avril 2026 — pic du mois", () => {
  const m = data.mois["2026-04"]

  it("pic le 23 avril à 24 présents, attaché au XO Day", () => {
    const pic = picDuMois(m)
    expect(pic.date.getDate()).toBe(23)
    expect(pic.total).toBe(24)
    expect(pic.evenement?.type).toBe("XO Day")
  })
})

describe("avril 2026 — distributions", () => {
  const m = data.mois["2026-04"]

  it("distribution sommée = nb actifs", () => {
    const d = distributionPresences(m)
    const total = Object.values(d).reduce((a, b) => a + b, 0)
    expect(total).toBe(nbActifs(m))
  })

  it("distribution : 4 consultants à 1 présence (les 4 sous-objectif)", () => {
    expect(distributionPresences(m)["1"]).toBe(4)
  })

  it("présence par jour de semaine : le jeudi domine (XO Day)", () => {
    const pjs = presenceParJourSemaine(m)
    expect(pjs.jeudi).toBeGreaterThan(pjs.lundi)
    expect(pjs.jeudi).toBeGreaterThan(pjs.mardi)
    expect(pjs.jeudi).toBeGreaterThan(pjs.mercredi)
    expect(pjs.jeudi).toBeGreaterThan(pjs.vendredi)
  })
})

describe("février 2026 — Zelal Aslan en absence longue", () => {
  const m = data.mois["2026-02"]

  it("nbActifs = 24 (25 lignes - Zelal exclue)", () => {
    expect(nbActifs(m)).toBe(24)
  })

  it("Zelal a statut absence_longue", () => {
    const z = m.lignes.find((l) => l.nom === "Zelal Aslan")
    expect(z).toBeDefined()
    expect(calculerStatutOKR(z!.jours)).toBe("absence_longue")
  })

  it("Esther Mussot n'est pas dans les saisies de février", () => {
    expect(m.lignes.find((l) => l.nom === "Esther Mussot")).toBeUndefined()
  })
})

describe("Référentiel : dateEntree d'Esther Mussot", () => {
  it("dateEntree = 2026-03-01", () => {
    const esther = data.consultants.find((c) => c.nom === "Esther Mussot")
    expect(esther).toBeDefined()
    expect(esther!.dateEntree).toBeDefined()
    expect(esther!.dateEntree!.getFullYear()).toBe(2026)
    expect(esther!.dateEntree!.getMonth() + 1).toBe(3)
    expect(esther!.dateEntree!.getDate()).toBe(1)
  })

  it("detecterIncoherences ne signale pas Esther en février (pas encore arrivée)", () => {
    const incohs = detecterIncoherences(data)
    const esther = incohs.filter((i) => i.consultant === "Esther Mussot")
    expect(esther).toEqual([])
  })
})

describe("Calixte Bailly — alerte 3 mois consécutifs", () => {
  it("historique : sous_objectif sur fév + mars + avril", () => {
    const h = historiqueConsultant(data, "Calixte Bailly", "2026-04", 3)
    expect(h).toEqual(["sous_objectif", "sous_objectif", "sous_objectif"])
  })

  it("est à risque sur 3 mois", () => {
    const h = historiqueConsultant(data, "Calixte Bailly", "2026-04", 3)
    expect(estARisque3Mois(h)).toBe(true)
  })
})

describe("Julien Calvao — IC permanent, jamais à risque", () => {
  it("historique : atteint chaque mois", () => {
    const h = historiqueConsultant(data, "Julien Calvao", "2026-04", 3)
    expect(h).toEqual(["atteint", "atteint", "atteint"])
  })

  it("pas à risque", () => {
    const h = historiqueConsultant(data, "Julien Calvao", "2026-04", 3)
    expect(estARisque3Mois(h)).toBe(false)
  })
})

describe("Zelal Aslan — absence_longue ignorée dans le calcul de risque", () => {
  it("historique : absence_longue, absence_longue, atteint", () => {
    const h = historiqueConsultant(data, "Zelal Aslan", "2026-04", 3)
    expect(h).toEqual(["absence_longue", "absence_longue", "atteint"])
  })

  it("pas à risque (le seul mois actif est atteint)", () => {
    const h = historiqueConsultant(data, "Zelal Aslan", "2026-04", 3)
    expect(estARisque3Mois(h)).toBe(false)
  })
})

describe("moisPrecedent", () => {
  it("renvoie le mois juste avant", () => {
    expect(moisPrecedent(data.cles, "2026-04")).toBe("2026-03")
    expect(moisPrecedent(data.cles, "2026-03")).toBe("2026-02")
  })

  it("renvoie null pour le premier mois", () => {
    expect(moisPrecedent(data.cles, "2026-02")).toBe(null)
  })
})

describe("detecterIncoherences", () => {
  // Les 6 ex-consultants ajoutés au commit fd2cb52 n'ont pas (encore)
  // de Date de sortie remplie au Référentiel ; Jérémie Kieffer y figure
  // sans saisie de présence (interne, pas consultant en mission). Tous
  // sont donc signalés "absent_de_saisie" sur chacun des 5 mois.
  // « Agnes Bregeon » apparaît dans Saisie 2026-06 sans entrée au
  // Référentiel : c'est une vraie incohérence à corriger côté saisie.
  // Ces tests décrivent l'état du fichier au moment de leur écriture ;
  // ils évolueront quand le Lead PM nettoiera ces cas.
  const NOMS_REFERENTIEL_SANS_SAISIE = [
    "Anita Aladine",
    "Camille Chansigaud",
    "Emilien Rue",
    "Gaetan Le Bail",
    "Melchior R",
    "Nicolas Renard",
    "Jérémie Kieffer",
  ]

  it("35 'absent_de_saisie' (7 consultants × 5 mois)", () => {
    const incohs = detecterIncoherences(data)
    const absents = incohs.filter((i) => i.type === "absent_de_saisie")
    expect(absents).toHaveLength(NOMS_REFERENTIEL_SANS_SAISIE.length * 5)
  })

  it("1 'saisi_hors_referentiel' : Agnes Bregeon en juin 2026", () => {
    const incohs = detecterIncoherences(data)
    const horsRef = incohs.filter((i) => i.type === "saisi_hors_referentiel")
    expect(horsRef).toEqual([
      {
        mois: "2026-06",
        consultant: "Agnes Bregeon",
        type: "saisi_hors_referentiel",
      },
    ])
  })

  it("noms flagués 'absent_de_saisie' = exactement la liste connue", () => {
    const incohs = detecterIncoherences(data)
    const nomsAbsents = new Set(
      incohs
        .filter((i) => i.type === "absent_de_saisie")
        .map((i) => i.consultant),
    )
    expect([...nomsAbsents].sort()).toEqual(
      [...NOMS_REFERENTIEL_SANS_SAISIE].sort(),
    )
  })

  it("détecte un consultant saisi hors référentiel et un consultant manquant", () => {
    const dataForge: typeof data = {
      consultants: [
        { nom: "Alice" },
        { nom: "Bob" }, // au référentiel mais absent des saisies
      ],
      evenements: [],
      mois: {
        "2026-04": {
          cle: "2026-04",
          annee: 2026,
          mois: 4,
          joursOuvres: [d(1)],
          lignes: [
            { nom: "Alice", jours: [{ date: d(1), valeur: 1 }] },
            { nom: "Charlie", jours: [{ date: d(1), valeur: 1 }] }, // saisi hors référentiel
          ],
          evenementsDuMois: [],
        },
      },
      cles: ["2026-04"],
    }
    const incohs = detecterIncoherences(dataForge)
    expect(incohs).toHaveLength(2)
    expect(incohs).toContainEqual({
      mois: "2026-04",
      consultant: "Charlie",
      type: "saisi_hors_referentiel",
    })
    expect(incohs).toContainEqual({
      mois: "2026-04",
      consultant: "Bob",
      type: "absent_de_saisie",
    })
  })

  it("ignore un consultant non encore arrivé (dateEntree > mois)", () => {
    const dataForge: typeof data = {
      consultants: [
        { nom: "Alice" },
        { nom: "Bob", dateEntree: new Date(2026, 4, 1) }, // arrive en mai
      ],
      evenements: [],
      mois: {
        "2026-04": {
          cle: "2026-04",
          annee: 2026,
          mois: 4,
          joursOuvres: [d(1)],
          lignes: [{ nom: "Alice", jours: [{ date: d(1), valeur: 1 }] }],
          evenementsDuMois: [],
        },
      },
      cles: ["2026-04"],
    }
    expect(detecterIncoherences(dataForge)).toEqual([])
  })
})

describe("vue trimestrielle : helpers", () => {
  it("trimestreDuMois('2026-04') = Q2 2026", () => {
    expect(trimestreDuMois("2026-04")).toEqual({ annee: 2026, numero: 2 })
  })

  it("trimestreDuMois('2026-02') = Q1 2026", () => {
    expect(trimestreDuMois("2026-02")).toEqual({ annee: 2026, numero: 1 })
  })

  it("clesDuTrimestre Q1 2026 = ['2026-02', '2026-03']", () => {
    expect(clesDuTrimestre(data.cles, 2026, 1)).toEqual([
      "2026-02",
      "2026-03",
    ])
  })

  it("clesDuTrimestre Q2 2026 = ['2026-04', '2026-05', '2026-06']", () => {
    expect(clesDuTrimestre(data.cles, 2026, 2)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
    ])
  })
})

describe("vue trimestrielle : KPI", () => {
  it("tauxAtteinteTrimestre Q2 = tauxAtteinte avril (1 seul mois)", () => {
    const taux = tauxAtteinteTrimestre(data, ["2026-04"])
    expect(taux).toBeCloseTo(tauxAtteinte(data.mois["2026-04"]), 5)
  })

  it("tauxAtteinteTrimestre Q1 = moyenne (taux fév + taux mars) / 2", () => {
    const attendu =
      (tauxAtteinte(data.mois["2026-02"]) +
        tauxAtteinte(data.mois["2026-03"])) /
      2
    expect(tauxAtteinteTrimestre(data, ["2026-02", "2026-03"])).toBeCloseTo(
      attendu,
      5,
    )
  })

  it("consultantsReguliersTrimestre Q1 : atteints ≤ total, total > 0", () => {
    const r = consultantsReguliersTrimestre(data, ["2026-02", "2026-03"])
    expect(r.total).toBeGreaterThan(0)
    expect(r.atteints).toBeGreaterThanOrEqual(0)
    expect(r.atteints).toBeLessThanOrEqual(r.total)
  })

  it("alertesRecurrentesTrimestre Q1 inclut Calixte Bailly (sous obj fév + mars)", () => {
    const alertes = alertesRecurrentesTrimestre(data, ["2026-02", "2026-03"])
    expect(alertes).toContain("Calixte Bailly")
  })

  it("alertesRecurrentesTrimestre n'inclut pas Julien Calvao (atteint partout)", () => {
    const alertes = alertesRecurrentesTrimestre(data, ["2026-02", "2026-03"])
    expect(alertes).not.toContain("Julien Calvao")
  })

  it("evolutionTauxAtteinte renvoie 5 points dans l'ordre chronologique", () => {
    const evo = evolutionTauxAtteinte(data)
    expect(evo).toHaveLength(5)
    expect(evo.map((e) => e.cle)).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ])
  })
})

describe("formations — computeFormationKPIs (fenêtre globale)", () => {
  const kpi = computeFormationKPIs(
    data.formations,
    data.participationsFormations,
  )

  it("nbSessions = 18 (catalogue complet)", () => {
    expect(kpi.nbSessions).toBe(18)
  })

  it("nbParticipantsUniques = 32 (consultants avec ≥1 P ou F)", () => {
    expect(kpi.nbParticipantsUniques).toBe(32)
  })

  it("top formateur : Jérémie Kieffer avec 8 animations", () => {
    expect(kpi.topFormateurs[0]).toEqual({ nom: "Jérémie Kieffer", nb: 8 })
  })

  it("top participant : Laureline Berthou avec 10 participations", () => {
    expect(kpi.topParticipants[0]).toEqual({ nom: "Laureline Berthou", nb: 10 })
  })

  it("topFormateurs et topParticipants sont triés desc et limités à 5", () => {
    expect(kpi.topFormateurs.length).toBeLessThanOrEqual(5)
    expect(kpi.topParticipants.length).toBeLessThanOrEqual(5)
    for (let i = 1; i < kpi.topFormateurs.length; i++) {
      expect(kpi.topFormateurs[i].nb).toBeLessThanOrEqual(
        kpi.topFormateurs[i - 1].nb,
      )
    }
    for (let i = 1; i < kpi.topParticipants.length; i++) {
      expect(kpi.topParticipants[i].nb).toBeLessThanOrEqual(
        kpi.topParticipants[i - 1].nb,
      )
    }
  })

  it("parConsultant : Jérémie Kieffer = 7 participations + 8 animations", () => {
    const j = kpi.parConsultant.find((c) => c.nom === "Jérémie Kieffer")
    expect(j).toEqual({
      nom: "Jérémie Kieffer",
      participations: 7,
      animations: 8,
    })
  })
})

describe("formations — filtrage temporel", () => {
  it("filtrerSessions sur 2026 retient 9 sessions (F-2026-001 → F-2026-009)", () => {
    const debut2026 = new Date(2026, 0, 1)
    const sessions2026 = filtrerSessions(data.formations, debut2026)
    expect(sessions2026).toHaveLength(9)
    expect(sessions2026.every((s) => s.idSession.startsWith("F-2026"))).toBe(
      true,
    )
  })

  it("computeFormationKPIs sur 2026 : nbSessions = 9", () => {
    const debut2026 = new Date(2026, 0, 1)
    const sessions2026 = filtrerSessions(data.formations, debut2026)
    const kpi = computeFormationKPIs(sessions2026, data.participationsFormations)
    expect(kpi.nbSessions).toBe(9)
    const totalP = kpi.parConsultant.reduce((a, c) => a + c.participations, 0)
    const totalF = kpi.parConsultant.reduce((a, c) => a + c.animations, 0)
    expect(totalP + totalF).toBeGreaterThan(0)
  })
})
