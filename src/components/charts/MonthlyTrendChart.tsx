import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { MoisKey } from "../../lib/types"
import {
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from "./_tooltipStyle"

interface Props {
  evolution: { cle: MoisKey; taux: number }[]
  clesTrimestre: MoisKey[]
}

const NOMS_MOIS_COURTS = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juill.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
]

export function MonthlyTrendChart({ evolution, clesTrimestre }: Props) {
  const trimestreSet = new Set(clesTrimestre)
  const dataset = evolution.map((e) => ({
    label: libelleMois(e.cle),
    taux: Math.round(e.taux * 100),
    estTrimestre: trimestreSet.has(e.cle),
  }))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">
        Évolution mensuelle du taux d'atteinte
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Cible : 100 %. Points bleus pleins : mois du trimestre sélectionné.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={dataset}
          margin={{ top: 12, right: 48, bottom: 8, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(v) => [`${v} %`, "Atteinte"]}
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
          />
          <ReferenceLine
            y={100}
            stroke="#10b981"
            strokeDasharray="4 4"
            label={{
              value: "Cible 100%",
              position: "right",
              fontSize: 10,
              fill: "#10b981",
            }}
          />
          <Line
            type="monotone"
            dataKey="taux"
            name="Atteinte"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={(props: {
              cx?: number
              cy?: number
              index?: number
            }) => {
              const idx = props.index ?? 0
              const isQ = dataset[idx]?.estTrimestre
              return (
                <circle
                  key={idx}
                  cx={props.cx}
                  cy={props.cy}
                  r={isQ ? 6 : 3}
                  fill={isQ ? "#3b82f6" : "#94a3b8"}
                  stroke="white"
                  strokeWidth={isQ ? 2 : 1}
                />
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function libelleMois(cle: MoisKey): string {
  const [annee, m] = cle.split("-")
  return `${NOMS_MOIS_COURTS[parseInt(m, 10) - 1]} ${annee.slice(2)}`
}
