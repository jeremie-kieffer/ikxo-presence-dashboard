import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parserBuffer } from "./excel-parser"
import {
  alertesRecurrentesTrimestre,
  calculerStatutOKR,
  clesDuTrimestre,
  compterPresences,
  consultantsReguliersTrimestre,
  detecterIncoherences,
  distributionPresences,
  estARisque3Mois,
  evolutionTauxAtteinte,
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

describe("avril 2026 — KPI cabinet", () => {
  const m = data.mois["2026-04"]

  it("26 actifs (Zelal en IC, donc active)", () => {
    expect(nbActifs(m)).toBe(26)
  })

  it("taux d'atteinte ≈ 77%", () => {
    expect(tauxAtteinte(m)).toBeCloseTo(0.77, 2)
  })

  it("présence moyenne ≈ 2.65j (arrondi 2.7 dans le brief)", () => {
    expect(presenceMoyenne(m)).toBeCloseTo(2.65, 1)
  })

  it("nbSousObjectif + nbAtteint = nbActifs", () => {
    const atteint = nbActifs(m) - nbSousObjectif(m)
    expect(atteint).toBe(20)
    expect(nbSousObjectif(m)).toBe(6)
  })

  it("nbVenusAuMoinsUneFois = 26 (tout le monde est venu au moins 1x en avril)", () => {
    expect(nbVenusAuMoinsUneFois(m)).toBe(26)
    expect(nbJamaisVenus(m)).toBe(0)
  })

  it("présence moyenne par jour (tous) ≈ 3.14 (69 présences / 22 jours ouvrés)", () => {
    expect(presenceMoyenneParJourTous(m)).toBeCloseTo(3.14, 1)
  })

  it("présence moyenne par jour (hors IC) ≈ 2.14 (47 présences '1' / 22 jours)", () => {
    // Consultants en IC en avril : Zelal (8 IC), Julien (9 IC),
    // Caroline (1 + 2 IC), Esther (1 + 1 IC) → exclus.
    // Reste 22 consultants, total des '1' = 69 − 8 − 9 − 3 − 2 = 47.
    expect(presenceMoyenneParJourHorsIntercontrat(m)).toBeCloseTo(47 / 22, 3)
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

  it("distribution : 6 consultants à 1 présence (les 6 sous-objectif)", () => {
    expect(distributionPresences(m)["1"]).toBe(6)
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
  it("aucune incohérence sur le fichier réel actuel", () => {
    expect(detecterIncoherences(data)).toEqual([])
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

  it("clesDuTrimestre Q2 2026 = ['2026-04']", () => {
    expect(clesDuTrimestre(data.cles, 2026, 2)).toEqual(["2026-04"])
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

  it("evolutionTauxAtteinte renvoie 3 points dans l'ordre chronologique", () => {
    const evo = evolutionTauxAtteinte(data)
    expect(evo).toHaveLength(3)
    expect(evo.map((e) => e.cle)).toEqual(["2026-02", "2026-03", "2026-04"])
  })
})
