import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { PresenceJourSemaine } from "../../lib/kpi-calculators"
import {
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from "./_tooltipStyle"

export function DayOfWeekChart({ data }: { data: PresenceJourSemaine }) {
  const dataset = [
    { jour: "Lun", n: data.lundi },
    { jour: "Mar", n: data.mardi },
    { jour: "Mer", n: data.mercredi },
    { jour: "Jeu", n: data.jeudi },
    { jour: "Ven", n: data.vendredi },
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">
        Présence par jour de la semaine
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Cumul des présences sur le mois
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dataset}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="jour" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "#f1f5f9" }}
          />
          <Bar
            dataKey="n"
            name="Présences"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
