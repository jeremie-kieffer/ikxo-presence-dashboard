import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parserBuffer } from "./excel-parser"
import {
  nbActifs,
  nbVenusAuMoinsUneFois,
  picDuMois,
  tauxAtteinte,
} from "./kpi-calculators"

const buf = readFileSync(
  resolve(__dirname, "../../tests/fixtures/suivi_presence_consultants.xlsx"),
)
const arrayBuffer = buf.buffer.slice(
  buf.byteOffset,
  buf.byteOffset + buf.byteLength,
) as ArrayBuffer
const data = parserBuffer(arrayBuffer)

// Baseline exécutable des KPI mensuels de présence — source de vérité pour la
// « Section Présence » de CLAUDE.md. Valeurs figées à la date de la fixture
// tests/fixtures/suivi_presence_consultants.xlsx (28 juillet 2026).
//   taux   = taux d'atteinte OKR arrondi en % (Math.round(taux * 100))
//   actifs = consultants suivis le mois (roster, hors absence longue)
//   venus  = consultants venus ≥1 fois
//   pic    = présences le jour le plus fréquenté
const BASELINE: Record<
  string,
  { taux: number; actifs: number; venus: number; pic: number }
> = {
  "2026-02": { taux: 63, actifs: 24, venus: 20, pic: 15 },
  "2026-03": { taux: 60, actifs: 25, venus: 23, pic: 17 },
  "2026-04": { taux: 85, actifs: 26, venus: 26, pic: 24 },
  "2026-05": { taux: 54, actifs: 26, venus: 24, pic: 21 },
  "2026-06": { taux: 78, actifs: 27, venus: 25, pic: 19 },
  "2026-07": { taux: 44, actifs: 25, venus: 17, pic: 10 },
}

function baselineDe(cle: string) {
  const b = BASELINE[cle]
  if (!b) throw new Error(`Mois ${cle} absent du baseline présence`)
  return b
}

describe("Baseline KPI mensuels de présence", () => {
  it("taux d'atteinte OKR par mois (%)", () => {
    for (const cle of data.cles) {
      expect(Math.round(tauxAtteinte(data.mois[cle]) * 100)).toBe(
        baselineDe(cle).taux,
      )
    }
  })

  it("nombre de consultants actifs (roster) par mois", () => {
    for (const cle of data.cles) {
      expect(nbActifs(data.mois[cle])).toBe(baselineDe(cle).actifs)
    }
  })

  it("consultants venus ≥1 fois par mois", () => {
    for (const cle of data.cles) {
      expect(nbVenusAuMoinsUneFois(data.mois[cle])).toBe(baselineDe(cle).venus)
    }
  })

  it("pic du mois (nb de présences le jour le plus fréquenté)", () => {
    for (const cle of data.cles) {
      expect(picDuMois(data.mois[cle]).total).toBe(baselineDe(cle).pic)
    }
  })
})
