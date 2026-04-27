import type { ReactNode } from "react"

type Accent = "vert" | "orange" | "rouge" | "bleu" | "violet" | "neutre"

interface Props {
  titre: string
  valeur: ReactNode
  sousLibelle?: string
  delta?: { valeur: string; sens: "hausse" | "baisse" | "stable" }
  accent?: Accent
}

const accentClasses: Record<Accent, string> = {
  vert: "border-l-4 border-l-emerald-500",
  orange: "border-l-4 border-l-amber-500",
  rouge: "border-l-4 border-l-red-500",
  bleu: "border-l-4 border-l-blue-500",
  violet: "border-l-4 border-l-violet-500",
  neutre: "border-l-4 border-l-slate-300",
}

export function KPICard({
  titre,
  valeur,
  sousLibelle,
  delta,
  accent = "neutre",
}: Props) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${accentClasses[accent]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {titre}
      </p>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{valeur}</div>
      {sousLibelle && (
        <p className="mt-1 text-sm text-slate-500">{sousLibelle}</p>
      )}
      {delta && (
        <p
          className={`mt-2 text-sm font-medium ${
            delta.sens === "hausse"
              ? "text-emerald-600"
              : delta.sens === "baisse"
                ? "text-red-600"
                : "text-slate-500"
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
