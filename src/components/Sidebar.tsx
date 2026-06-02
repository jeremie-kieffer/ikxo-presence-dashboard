// Navigation latérale primaire (modules). Les contrôles secondaires
// (Mensuelle/Trimestrielle/mois) restent dans le main pour distinguer
// nav primaire et filtres contextuels.

import { libelleMiseAJour } from "../lib/format"

export type Module = "presence" | "formation"

type IconName = "calendar" | "school" | "sparkles" | "user"

const MODULES_ACTIFS: { id: Module; label: string; icon: IconName }[] = [
  { id: "presence", label: "Présence", icon: "calendar" },
  { id: "formation", label: "Formation", icon: "school" },
]

const MODULES_A_VENIR: { label: string; icon: IconName }[] = [
  { label: "Rituels", icon: "sparkles" },
  { label: "Vue consultant", icon: "user" },
]

export function Sidebar({
  module,
  onChange,
  dateMiseAJour = null,
}: {
  module: Module
  onChange: (m: Module) => void
  dateMiseAJour?: Date | null
}) {
  const libelleMaj = libelleMiseAJour(dateMiseAJour)
  return (
    <aside className="flex h-full flex-col bg-gray-50 [border-right:0.5px_solid_#e5e7eb]">
      <div className="px-5 pb-4 pt-6">
        <h1 className="font-heading text-lg font-semibold tracking-tight text-ikxo-blue">
          Dashboard IKXO
        </h1>
        {libelleMaj && (
          <p className="mt-1 text-xs text-gray-500">{libelleMaj}</p>
        )}
      </div>
      <div className="[border-top:0.5px_solid_#e5e7eb]" />

      <nav className="flex-1 px-2 py-4">
        <ul className="space-y-0.5">
          {MODULES_ACTIFS.map((m) => (
            <li key={m.id}>
              <SidebarItem
                icon={m.icon}
                label={m.label}
                active={module === m.id}
                onClick={() => onChange(m.id)}
              />
            </li>
          ))}
        </ul>

        <div className="mt-8 px-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            À venir
          </p>
        </div>
        <ul className="mt-2 space-y-0.5">
          {MODULES_A_VENIR.map((m) => (
            <li key={m.label}>
              <SidebarItem icon={m.icon} label={m.label} disabled />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

function SidebarItem({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: IconName
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  if (disabled) {
    return (
      <div className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-400">
        <Icon name={icon} />
        <span>{label}</span>
      </div>
    )
  }
  if (active) {
    // Background ikxo-blue à 8% + filet vertical 2px. La couleur du fond
    // est volontairement en rgba inline car la palette @theme n'expose
    // pas de variante alpha.
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-md border-l-2 border-ikxo-blue px-3 py-2 text-sm font-semibold text-ikxo-blue"
        style={{ backgroundColor: "rgba(12, 56, 103, 0.08)" }}
      >
        <Icon name={icon} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-ikxo-blue"
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )
}

// SVG inline des icônes Tabler (MIT). Évite une dépendance pour 4 icônes.
function Icon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  switch (name) {
    case "calendar":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M4 11h16" />
        </svg>
      )
    case "school":
      return (
        <svg {...common}>
          <path d="M22 9 12 5 2 9l10 4 10-4v6" />
          <path d="M6 10.6V16a6 3 0 0 0 12 0v-5.4" />
        </svg>
      )
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      )
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      )
  }
}
