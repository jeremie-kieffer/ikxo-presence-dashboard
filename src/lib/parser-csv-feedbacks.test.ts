import { describe, expect, it } from "vitest"
import {
  parseTimestampGForms,
  parserCSVFeedbacks,
} from "./parser-csv-feedbacks"

describe("parseTimestampGForms", () => {
  it("parse un timestamp PM", () => {
    expect(parseTimestampGForms("2026/07/29 3:08:24 PM UTC+3")).toBe(
      "2026-07-29T15:08:24+03:00",
    )
  })
  it("parse un timestamp AM", () => {
    expect(parseTimestampGForms("2026/07/29 9:08:24 AM UTC+3")).toBe(
      "2026-07-29T09:08:24+03:00",
    )
  })
  it("parse midi (12 PM → 12h)", () => {
    expect(parseTimestampGForms("2026/07/29 12:00:00 PM UTC+3")).toBe(
      "2026-07-29T12:00:00+03:00",
    )
  })
  it("parse minuit (12 AM → 00h)", () => {
    expect(parseTimestampGForms("2026/07/29 12:00:00 AM UTC+3")).toBe(
      "2026-07-29T00:00:00+03:00",
    )
  })
  it("parse un fuseau négatif et à un chiffre", () => {
    expect(parseTimestampGForms("2026/04/08 10:04:06 AM UTC+2")).toBe(
      "2026-04-08T10:04:06+02:00",
    )
  })
  it("retourne null sur format inattendu", () => {
    expect(parseTimestampGForms("pas une date")).toBeNull()
    expect(parseTimestampGForms("2026-07-29 15:08:24")).toBeNull()
    expect(parseTimestampGForms("2026/07/29 13:08:24 PM UTC+3")).toBeNull() // 13h en 12h
  })
})

const HEADER = '"Horodateur","Note","Application","Apprécié","Amélioration","Autre"'

function csv(...lignes: string[]): string {
  return [HEADER, ...lignes].join("\n")
}

describe("parserCSVFeedbacks", () => {
  it("parse un CSV complet de 5 lignes valides", () => {
    const contenu = csv(
      '"2026/07/29 9:00:00 AM UTC+3","5","Oui immédiatement","Super","RAS","Merci"',
      '"2026/07/29 9:05:00 AM UTC+3","4","Peut-être","Bien","Plus de pratique",""',
      '"2026/07/29 9:10:00 AM UTC+3","3","Non","Moyen","Trop court","N/A"',
      '"2026/07/29 9:15:00 AM UTC+3","5","Oui immédiatement","Top",""," "',
      '"2026/07/29 9:20:00 AM UTC+3","2","Pas sûr","","Rythme","autre"',
    )
    const { valides, invalides } = parserCSVFeedbacks(contenu, "F-2026-011")
    expect(valides).toHaveLength(5)
    expect(invalides).toHaveLength(0)
    expect(valides[0].note_globale).toBe(5)
    expect(valides[0].application).toBe("Oui immédiatement")
    expect(valides[1].verbatim_commentaire).toBe("")
  })

  it("gère les virgules, guillemets et retours ligne dans les verbatims", () => {
    const contenu = csv(
      '"2026/07/29 9:00:00 AM UTC+3","5","Oui","Un verbatim avec, une virgule et un ""guillemet""","ligne 1\nligne 2","fin"',
    )
    const { valides } = parserCSVFeedbacks(contenu, "F-2026-011")
    expect(valides).toHaveLength(1)
    expect(valides[0].verbatim_apprecie).toBe(
      'Un verbatim avec, une virgule et un "guillemet"',
    )
    expect(valides[0].verbatim_amelioration).toBe("ligne 1\nligne 2")
  })

  it("marque les notes hors bornes comme invalides", () => {
    const contenu = csv(
      '"2026/07/29 9:00:00 AM UTC+3","0","x","","",""',
      '"2026/07/29 9:05:00 AM UTC+3","6","x","","",""',
      '"2026/07/29 9:10:00 AM UTC+3","abc","x","","",""',
    )
    const { valides, invalides } = parserCSVFeedbacks(contenu, "F-2026-011")
    expect(valides).toHaveLength(0)
    expect(invalides).toHaveLength(3)
  })

  it("marque une ligne au timestamp illisible comme invalide (sans rejeter tout)", () => {
    const contenu = csv(
      '"2026/07/29 9:00:00 AM UTC+3","5","x","","",""',
      '"pas une date","4","x","","",""',
    )
    const { valides, invalides } = parserCSVFeedbacks(contenu, "F-2026-011")
    expect(valides).toHaveLength(1)
    expect(invalides).toHaveLength(1)
    expect(invalides[0].raison).toMatch(/Horodateur/)
  })

  it("rejette un CSV à 5 colonnes", () => {
    const contenu =
      '"Horodateur","Note","Application","Apprécié","Amélioration"\n' +
      '"2026/07/29 9:00:00 AM UTC+3","5","x","",""'
    expect(() => parserCSVFeedbacks(contenu, "F-2026-011")).toThrow(/colonne/)
  })

  it("rejette un fichier sans ligne de données", () => {
    expect(() => parserCSVFeedbacks(HEADER, "F-2026-011")).toThrow(
      /Aucune ligne/,
    )
  })

  it("rejette un fichier dont tous les timestamps sont illisibles", () => {
    const contenu = csv(
      '"nope","5","x","","",""',
      '"nope2","4","x","","",""',
    )
    expect(() => parserCSVFeedbacks(contenu, "F-2026-011")).toThrow(
      /toutes les lignes/,
    )
  })

  it("génère un id = session_id + _ + timestamp iso", () => {
    const contenu = csv(
      '"2026/07/29 3:08:24 PM UTC+3","5","x","","",""',
    )
    const { valides } = parserCSVFeedbacks(contenu, "F-2026-011")
    expect(valides[0].id).toBe("F-2026-011_2026-07-29T15:08:24+03:00")
  })
})
