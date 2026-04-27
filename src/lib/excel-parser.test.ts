import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parserBuffer } from "./excel-parser"

const buf = readFileSync(
  resolve(__dirname, "../../public/data/suivi_presence_consultants.xlsx"),
)
const arrayBuffer = buf.buffer.slice(
  buf.byteOffset,
  buf.byteOffset + buf.byteLength,
) as ArrayBuffer

const data = parserBuffer(arrayBuffer)

describe("excel-parser : structure générale", () => {
  it("charge 26 consultants au référentiel", () => {
    expect(data.consultants).toHaveLength(26)
  })

  it("détecte les 3 onglets de saisie disponibles", () => {
    expect(data.cles).toEqual(["2026-02", "2026-03", "2026-04"])
  })

  it("extrait 3 événements globaux", () => {
    expect(data.evenements).toHaveLength(3)
    const types = data.evenements.map((e) => e.type).sort()
    expect(types).toEqual(["XO Day", "XO Day", "XO Product Day"])
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

  it("Zelal Aslan : 8 IC, aucune valeur 1", () => {
    const z = m.lignes.find((l) => l.nom === "Zelal Aslan")
    expect(z).toBeDefined()
    expect(z!.jours.filter((j) => j.valeur === "IC")).toHaveLength(8)
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
