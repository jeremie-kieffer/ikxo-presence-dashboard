import type { ReactNode } from "react"
import type { CouleurValeur } from "../lib/seuils-design"

type Accent = "vert" | "orange" | "rouge" | "bleu" | "violet" | "neutre"

interface Props {
  titre: string
  valeur: ReactNode
  sousLibelle?: string
  delta?: { valeur: string; sens: "hausse" | "baisse" | "stable" }
  accent?: Accent
  // Couleur du grand chiffre central. Défaut "bleu" (text-ikxo-blue).
  // Utilisé pour porter une sémantique : "vert" = signal positif/atteint,
  // "orange" = alerte. La logique conditionnelle reste côté vue (qui
  // appelle couleurTauxOKR() depuis seuils-design.ts).
  couleurValeur?: CouleurValeur
}

// Mapping accent → couleur de border-left (3px) selon la charte IKXO.
// Note : rouge et violet sont mappés sur ikxo-orange et ikxo-blue car la
// palette IKXO n'inclut pas ces deux teintes (le rose Product Club est
// hors scope).
const accentClasses: Record<Accent, string> = {
  vert: "border-l-[3px] border-l-ikxo-green",
  orange: "border-l-[3px] border-l-ikxo-orange",
  rouge: "border-l-[3px] border-l-ikxo-orange",
  bleu: "border-l-[3px] border-l-ikxo-blue",
  violet: "border-l-[3px] border-l-ikxo-blue",
  neutre: "border-l-[3px] border-l-ikxo-blue",
}

const couleurValeurClasses: Record<CouleurValeur, string> = {
  vert: "text-ikxo-green",
  bleu: "text-ikxo-blue",
  orange: "text-ikxo-orange",
}

export function KPICard({
  titre,
  valeur,
  sousLibelle,
  delta,
  accent = "neutre",
  couleurValeur = "bleu",
}: Props) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${accentClasses[accent]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {titre}
      </p>
      <div
        className={`mt-2 text-3xl font-semibold ${couleurValeurClasses[couleurValeur]}`}
      >
        {valeur}
      </div>
      {sousLibelle && (
        <p className="mt-1 text-sm text-slate-500">{sousLibelle}</p>
      )}
      {delta && (
        <p
          className={`mt-2 text-sm font-medium ${
            delta.sens === "hausse"
              ? "text-ikxo-green"
              : delta.sens === "baisse"
                ? "text-red-600"
                : "text-gray-500"
          }`}
        >
          {delta.sens === "hausse" ? "↑" : delta.sens === "baisse" ? "↓" : "—"}{" "}
          {delta.valeur}{" "}
          <span className="text-slate-400">vs M-1</span>
        </p>
      )}
    </div>
  )
}
