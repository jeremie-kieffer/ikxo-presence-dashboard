import { deconnecter } from "../lib/auth-helpers"
import { useSession } from "../lib/use-session"

/**
 * Composant temporaire de validation du hook useSession (substep 5.1.b.1).
 * Sera retiré à la substep 5.1.b.3, quand la Sidebar assurera l'affichage de
 * l'état d'auth et la déconnexion de manière intégrée.
 */
export function AuthDebug() {
  const { user, loading } = useSession()

  const base =
    "mb-4 inline-flex items-center gap-3 rounded-md border px-3 py-1.5 text-sm"

  if (loading) {
    return (
      <div className={`${base} border-slate-200 bg-slate-50 text-slate-500`}>
        Chargement…
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`${base} border-slate-200 bg-slate-50 text-slate-600`}>
        Non connecté
      </div>
    )
  }

  return (
    <div className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>
      <span>
        Connecté : <span className="font-medium">{user.email}</span>
      </span>
      <button
        type="button"
        onClick={() => void deconnecter()}
        className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
      >
        Se déconnecter
      </button>
    </div>
  )
}
