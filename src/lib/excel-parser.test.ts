import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { chargerFichier, parserBuffer } from "./excel-parser"

const buf = readFileSync(
  resolve(__dirname, "../../tests/fixtures/suivi_presence_consultants.xlsx"),
)
const arrayBuffer = buf.buffer.slice(
  buf.byteOffset,
  buf.byteOffset + buf.byteLength,
) as ArrayBuffer

const data = parserBuffer(arrayBuffer)

describe("excel-parser : structure générale", () => {
  it("charge 34 consultants au référentiel (26 actifs + 6 ex + Jérémie interne + Agnes Bregeon)", () => {
    expect(data.consultants).toHaveLength(34)
  })

  it("lit le rôle et les dates du Référentiel (Jérémie interne, Agnes entrée juin)", () => {
    const jeremie = data.consultants.find((c) => c.nom === "Jérémie Kieffer")
    expect(jeremie?.role).toBe("interne")

    const agnes = data.consultants.find((c) => c.nom === "Agnes Bregeon")
    expect(agnes?.role).toBe("consultant") // colonne Rôle vide → défaut
    expect(agnes?.dateEntree?.getFullYear()).toBe(2026)
    expect(agnes?.dateEntree?.getMonth()).toBe(5) // juin (0-indexé)

    const anita = data.consultants.find((c) => c.nom === "Anita Aladine")
    expect(anita?.dateSortie?.getMonth()).toBe(0) // janvier (0-indexé)
  })

  it("détecte les 5 onglets de saisie disponibles", () => {
    expect(data.cles).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ])
  })

  it("extrait 3 événements globaux", () => {
    expect(data.evenements).toHaveLength(3)
    const types = data.evenements.map((e) => e.type).sort()
    expect(types).toEqual(["XO Day", "XO Day", "XO Product Day"])
  })
})

describe("chargerFichier : date de mise à jour (injectée au build)", () => {
  afterEach(() => vi.unstubAllGlobals())

  // Réponse fetch minimale : buffer xlsx réel. Les headers HTTP n'influencent
  // plus la date (Cloudflare ne sert pas Last-Modified) → on n'en fournit pas.
  const stubFetch = () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => arrayBuffer,
        headers: { get: () => null },
      })),
    )
  }

  it("expose la date du build, indépendamment des headers HTTP", async () => {
    stubFetch()
    const d = await chargerFichier()
    expect(d.dateMiseAJour).toBeInstanceOf(Date)
    expect(Number.isNaN(d.dateMiseAJour!.getTime())).toBe(false)
    expect(d.dateMiseAJour).toEqual(new Date(__DATE_MISE_A_JOUR__))
  })

  it("__DATE_MISE_A_JOUR__ est bien injecté en mode test (config Vite partagée)", () => {
    expect(typeof __DATE_MISE_A_JOUR__).toBe("string")
    expect(Number.isNaN(new Date(__DATE_MISE_A_JOUR__).getTime())).toBe(false)
  })

  it("parserBuffer seul (sans date fournie) → dateMiseAJour null", () => {
    expect(parserBuffer(arrayBuffer).dateMiseAJour).toBeNull()
  })
})

describe("excel-parser : avril 2026", () => {
  const m = data.mois["2026-04"]

  it("a 22 jours ouvrés", () => {
    expect(m.joursOuvres).toHaveLength(22)
  })

  it("a 26 lignes de saisie", () => {
    expect(m.lignes).toHaveLength(26)
  })

  it("rattache le XO Day du 23 avril", () => {
    expect(m.evenementsDuMois).toHaveLength(1)
    expect(m.evenementsDuMois[0].type).toBe("XO Day")
    expect(m.evenementsDuMois[0].date.getDate()).toBe(23)
  })

  it("Zelal Aslan : 11 IC, aucune valeur 1", () => {
    const z = m.lignes.find((l) => l.nom === "Zelal Aslan")
    expect(z).toBeDefined()
    expect(z!.jours.filter((j) => j.valeur === "IC")).toHaveLength(11)
    expect(z!.jours.filter((j) => j.valeur === 1)).toHaveLength(0)
  })

  it("Calixte Bailly : 1 présence", () => {
    const c = m.lignes.find((l) => l.nom === "Calixte Bailly")
    expect(c).toBeDefined()
    const total = c!.jours.filter(
      (j) => j.valeur === 1 || j.valeur === "IC",
    ).length
    expect(total).toBe(1)
  })
})

describe("excel-parser : février 2026", () => {
  const m = data.mois["2026-02"]

  it("Zelal Aslan a au moins une cellule M (congé mat)", () => {
    const z = m.lignes.find((l) => l.nom === "Zelal Aslan")
    expect(z).toBeDefined()
    expect(z!.jours.some((j) => j.valeur === "M")).toBe(true)
  })

  it("rattache le XO Product Day du 19 février", () => {
    expect(m.evenementsDuMois).toHaveLength(1)
    expect(m.evenementsDuMois[0].type).toBe("XO Product Day")
    expect(m.evenementsDuMois[0].date.getDate()).toBe(19)
  })
})

describe("excel-parser : Formations (catalogue)", () => {
  it("charge 18 sessions historiques", () => {
    expect(data.formations).toHaveLength(18)
  })

  it("première session = F-2025-001 (Jérémie Kieffer, mars 2025)", () => {
    const f = data.formations[0]
    expect(f.idSession).toBe("F-2025-001")
    expect(f.formateurs).toEqual(["Jérémie Kieffer"])
    expect(f.date.getFullYear()).toBe(2025)
    expect(f.date.getMonth() + 1).toBe(3)
  })

  it("dernière session = F-2026-009 (Simon Kerhyuel, mai 2026)", () => {
    const f = data.formations[data.formations.length - 1]
    expect(f.idSession).toBe("F-2026-009")
    expect(f.formateurs).toEqual(["Simon Kerhyuel"])
    expect(f.date.getFullYear()).toBe(2026)
    expect(f.date.getMonth() + 1).toBe(5)
  })

  it("toutes les sessions ont une date valide et au moins un formateur", () => {
    for (const f of data.formations) {
      expect(f.date instanceof Date).toBe(true)
      expect(Number.isFinite(f.date.getTime())).toBe(true)
      expect(f.formateurs.length).toBeGreaterThanOrEqual(1)
    }
  })

  it("toutes les sessions sont triées chronologiquement (ordre du fichier)", () => {
    for (let i = 1; i < data.formations.length; i++) {
      expect(data.formations[i].date.getTime()).toBeGreaterThanOrEqual(
        data.formations[i - 1].date.getTime(),
      )
    }
  })
})

describe("excel-parser : Formations_Participations (matrice)", () => {
  it("Laureline Berthou : 10 'P', 0 'F'", () => {
    const p = data.participationsFormations.get("Laureline Berthou")
    expect(p).toBeDefined()
    const codes = [...p!.values()]
    expect(codes.filter((c) => c === "P")).toHaveLength(10)
    expect(codes.filter((c) => c === "F")).toHaveLength(0)
  })

  it("Jérémie Kieffer : 7 'P' + 8 'F' (= 15 total, formule du Total Excel)", () => {
    const p = data.participationsFormations.get("Jérémie Kieffer")
    expect(p).toBeDefined()
    const codes = [...p!.values()]
    expect(codes.filter((c) => c === "P")).toHaveLength(7)
    expect(codes.filter((c) => c === "F")).toHaveLength(8)
  })

  it("Calixte Bailly anime F-2026-008", () => {
    const p = data.participationsFormations.get("Calixte Bailly")
    expect(p?.get("F-2026-008")).toBe("F")
  })

  it("la matrice référence exactement les 18 sessions du catalogue", () => {
    const idsCatalogue = new Set(data.formations.map((f) => f.idSession))
    for (const sessions of data.participationsFormations.values()) {
      for (const id of sessions.keys()) {
        expect(idsCatalogue.has(id)).toBe(true)
      }
    }
  })
})
