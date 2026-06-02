import { describe, expect, it } from "vitest"
import { formatDateCourte, formatFr, libelleMiseAJour } from "./format"

describe("formatFr", () => {
  it("utilise la virgule décimale", () => {
    expect(formatFr(3.14)).toBe("3,1")
    expect(formatFr(2.65, 2)).toBe("2,65")
  })
})

describe("formatDateCourte", () => {
  it("formate en JJ/MM zéro-paddé", () => {
    expect(formatDateCourte(new Date(2026, 3, 2, 12))).toBe("02/04")
  })
})

describe("libelleMiseAJour", () => {
  it("construit la phrase au format français long", () => {
    // Midi local pour éviter tout décalage de fuseau sur la date affichée.
    expect(libelleMiseAJour(new Date(2026, 5, 2, 12))).toBe(
      "Données à jour au 2 juin 2026",
    )
  })

  it("retourne null si la date est absente (pas de placeholder)", () => {
    expect(libelleMiseAJour(null)).toBeNull()
  })
})
