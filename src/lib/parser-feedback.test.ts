import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parserBuffer, parserFormationFeedbacks } from "./excel-parser"

const buf = readFileSync(
  resolve(__dirname, "../../tests/fixtures/suivi_presence_consultants.xlsx"),
)
const arrayBuffer = buf.buffer.slice(
  buf.byteOffset,
  buf.byteOffset + buf.byteLength,
) as ArrayBuffer
const data = parserBuffer(arrayBuffer)

describe("parser feedback formation : structure générale", () => {
  it("charge 47 feedbacks au total", () => {
    expect(data.feedbacksFormation).toHaveLength(47)
  })

  it("couvre 7 sessions distinctes", () => {
    const ids = new Set(data.feedbacksFormation.map((f) => f.idSession))
    expect(ids.size).toBe(7)
    expect([...ids].sort()).toEqual([
      "F-2026-003",
      "F-2026-004",
      "F-2026-005",
      "F-2026-006",
      "F-2026-007",
      "F-2026-008",
      "F-2026-009",
    ])
  })

  it("tous les feedbacks ont timestamp valide, note 1-5 et application non-vide", () => {
    for (const f of data.feedbacksFormation) {
      expect(f.timestamp instanceof Date).toBe(true)
      expect(Number.isFinite(f.timestamp.getTime())).toBe(true)
      expect(f.noteGlobale).toBeGreaterThanOrEqual(1)
      expect(f.noteGlobale).toBeLessThanOrEqual(5)
      expect(f.application.length).toBeGreaterThan(0)
    }
  })

  it("retombe sur 4 valeurs uniques pour application", () => {
    const vals = new Set(data.feedbacksFormation.map((f) => f.application))
    expect(vals.size).toBe(4)
    expect(vals.has("Oui immédiatement")).toBe(true)
    expect(vals.has("Oui mais j'ai besoin de plus de pratique")).toBe(true)
    expect(vals.has("Pas sûr")).toBe(true)
    expect(vals.has("Non")).toBe(true)
  })

  it("premier feedback = r-001 sur F-2026-009, note 5", () => {
    const r1 = data.feedbacksFormation.find((f) => f.idResponse === "r-001")
    expect(r1).toBeDefined()
    expect(r1!.idSession).toBe("F-2026-009")
    expect(r1!.noteGlobale).toBe(5)
    expect(r1!.application).toBe("Oui mais j'ai besoin de plus de pratique")
    expect(r1!.verbatimApprecie.length).toBeGreaterThan(0)
  })
})

describe("parser feedback formation : backward-compat", () => {
  it("retourne [] si l'onglet est absent", () => {
    expect(parserFormationFeedbacks(undefined)).toEqual([])
  })
})
