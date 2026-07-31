import { describe, expect, it } from "vitest"
import { comparerParNomFamille, nomDeFamille } from "./tri-noms"

describe("nomDeFamille", () => {
  it("prend le dernier mot par défaut", () => {
    expect(nomDeFamille("Achille Bruant")).toBe("Bruant")
    expect(nomDeFamille("Zelal Aslan")).toBe("Aslan")
  })

  it("gère les particules françaises", () => {
    expect(nomDeFamille("Florian Le Fur")).toBe("Le Fur")
    expect(nomDeFamille("Gaetan Le Bail")).toBe("Le Bail")
    expect(nomDeFamille("Jean De La Roche")).toBe("De La Roche")
  })

  it("gère les particules étrangères", () => {
    expect(nomDeFamille("Marie Van Der Berg")).toBe("Van Der Berg")
  })

  it("cas limites : vide, un seul mot, espaces multiples", () => {
    expect(nomDeFamille("")).toBe("")
    expect(nomDeFamille("   ")).toBe("")
    expect(nomDeFamille("Cher")).toBe("Cher")
    expect(nomDeFamille("Florian   Le   Fur")).toBe("Le Fur")
  })
})

describe("comparerParNomFamille", () => {
  it("trie une liste par nom de famille (particules incluses)", () => {
    const liste = [
      "Florian Le Fur",
      "Achille Bruant",
      "Gaetan Le Bail",
      "Zelal Aslan",
    ]
    expect([...liste].sort(comparerParNomFamille)).toEqual([
      "Zelal Aslan",
      "Achille Bruant",
      "Gaetan Le Bail",
      "Florian Le Fur",
    ])
  })

  it("est insensible à la casse et aux accents (sensitivity base)", () => {
    expect(comparerParNomFamille("Jean Ébène", "Marie Ebene")).toBe(0)
  })
})
