import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { Distribution } from "../../lib/kpi-calculators"
import {
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from "./_tooltipStyle"

export function DistributionChart({ data }: { data: Distribution }) {
  const dataset = (Object.keys(data) as (keyof Distribution)[]).map((k) => ({
    tranche: k === "5+" ? "5+ j" : `${k} j`,
    nb: data[k],
  }))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">
        Distribution des présences
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Nombre de consultants actifs par tranche de présences
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dataset}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="tranche" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "#f1f5f9" }}
          />
          <Bar
            dataKey="nb"
            name="Consultants"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
