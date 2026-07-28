import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parserBuffer } from "./excel-parser"
import {
  computeFeedbackKPIs,
  computeFeedbackParSession,
  nbParticipantsParSession,
  noteMoyenneParFormateur,
} from "./kpi-calculators"

const buf = readFileSync(
  resolve(__dirname, "../../tests/fixtures/suivi_presence_consultants.xlsx"),
)
const arrayBuffer = buf.buffer.slice(
  buf.byteOffset,
  buf.byteOffset + buf.byteLength,
) as ArrayBuffer
const data = parserBuffer(arrayBuffer)

// Valeurs de référence à la date de la fixture
// tests/fixtures/suivi_presence_consultants.xlsx (28 juillet 2026).
describe("computeFeedbackKPIs : globaux", () => {
  const kpi = computeFeedbackKPIs(
    data.feedbacksFormation,
    data.participationsFormations,
  )

  it("nbFeedbacksTotal = 63", () => {
    expect(kpi.nbFeedbacksTotal).toBe(63)
  })

  it("nbSessionsAvecFeedback = 9", () => {
    expect(kpi.nbSessionsAvecFeedback).toBe(9)
  })

  it("noteMoyenneGlobale ≈ 4.52 (somme/63)", () => {
    expect(kpi.noteMoyenneGlobale).toBeCloseTo(4.5238, 2)
  })

  it("distribApplication : 35 + 16 + 8 + 4 = 63", () => {
    const d = kpi.distribApplication
    expect(d["Oui immédiatement"]).toBe(35)
    expect(d["Oui mais j'ai besoin de plus de pratique"]).toBe(16)
    expect(d["Pas sûr"]).toBe(8)
    expect(d["Non"]).toBe(4)
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(63)
  })

  it("tauxRetourMoyen ≈ 0.78 (moyenne pondérée par session)", () => {
    expect(kpi.tauxRetourMoyen).toBeCloseTo(0.7812, 2)
  })

  it("vide en l'absence de feedbacks", () => {
    const vide = computeFeedbackKPIs([], data.participationsFormations)
    expect(vide.nbFeedbacksTotal).toBe(0)
    expect(vide.noteMoyenneGlobale).toBe(0)
    expect(vide.tauxRetourMoyen).toBe(0)
    expect(vide.distribApplication).toEqual({})
  })
})

describe("computeFeedbackParSession", () => {
  it("F-2026-009 : 5 retours, 9 participants, note moyenne 3.6", () => {
    const s = computeFeedbackParSession(
      "F-2026-009",
      data.feedbacksFormation,
      data.participationsFormations,
    )
    expect(s.nbRetours).toBe(5)
    expect(s.nbParticipants).toBe(9)
    expect(s.tauxRetour).toBeCloseTo(5 / 9, 3)
    expect(s.noteMoyenne).toBeCloseTo(3.6, 2)
  })

  it("F-2026-006 : 7 retours, 5 participants, note moyenne 4.86", () => {
    const s = computeFeedbackParSession(
      "F-2026-006",
      data.feedbacksFormation,
      data.participationsFormations,
    )
    expect(s.nbRetours).toBe(7)
    expect(s.nbParticipants).toBe(5)
    expect(s.noteMoyenne).toBeCloseTo(4.857, 2)
    // Taux peut dépasser 100% si la matrice sous-estime les participants
    // réels — c'est un signal côté donnée, pas un bug.
    expect(s.tauxRetour).toBeGreaterThan(1)
  })

  it("session sans feedback : nbRetours = 0, noteMoyenne = null", () => {
    const s = computeFeedbackParSession(
      "F-2025-001",
      data.feedbacksFormation,
      data.participationsFormations,
    )
    expect(s.nbRetours).toBe(0)
    expect(s.noteMoyenne).toBe(null)
    expect(s.tauxRetour).toBe(0)
    expect(Object.values(s.distributionNotes).reduce((a, b) => a + b, 0)).toBe(
      0,
    )
  })

  it("distributionNotes : somme = nbRetours", () => {
    const s = computeFeedbackParSession(
      "F-2026-009",
      data.feedbacksFormation,
      data.participationsFormations,
    )
    const somme = Object.values(s.distributionNotes).reduce((a, b) => a + b, 0)
    expect(somme).toBe(s.nbRetours)
  })
})

describe("nbParticipantsParSession", () => {
  it("F-2026-009 a 9 participants (F+P dans la matrice)", () => {
    const m = nbParticipantsParSession(data.participationsFormations)
    expect(m.get("F-2026-009")).toBe(9)
  })
})

describe("noteMoyenneParFormateur", () => {
  const notes = noteMoyenneParFormateur(
    data.feedbacksFormation,
    data.formations,
  )

  it("Jérémie Kieffer ≈ 4.857 sur 1 session avec feedback (F-2026-006)", () => {
    const j = notes.get("Jérémie Kieffer")
    expect(j).toBeDefined()
    expect(j!.note).toBeCloseTo(4.857, 2)
    expect(j!.nbSessionsAvecFeedback).toBe(1)
  })

  it("Théo Esposito : 3 sessions avec feedback", () => {
    const t = notes.get("Théo Esposito")
    expect(t).toBeDefined()
    expect(t!.nbSessionsAvecFeedback).toBe(3)
    expect(t!.note).toBeCloseTo(4.4265, 2)
  })

  it("Florian Le Fur n'apparaît pas (sessions sans feedback)", () => {
    expect(notes.has("Florian Le Fur")).toBe(false)
  })
})
