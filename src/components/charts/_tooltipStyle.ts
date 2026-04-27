// Styles partagés pour les <Tooltip> de Recharts, alignés sur le tooltip
// custom utilisé dans le tableau (fond slate-900, texte clair).

export const TOOLTIP_CONTENT_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  backgroundColor: "#0f172a",
  border: "none",
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
} as const

export const TOOLTIP_LABEL_STYLE = {
  color: "white",
  fontWeight: 600,
  marginBottom: 2,
} as const

export const TOOLTIP_ITEM_STYLE = {
  color: "#e2e8f0",
} as const
