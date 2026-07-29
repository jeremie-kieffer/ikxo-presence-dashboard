import type { ReactNode } from "react"
import { useSession } from "../lib/use-session"
import { LoginScreen } from "./LoginScreen"

/**
 * Garde d'authentification pour les vues d'administration.
 * - `loading` : état neutre le temps de résoudre la session.
 * - pas de session : affiche l'écran de connexion (magic link).
 * - session active : rend les enfants (la vue admin protégée).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center text-sm text-gray-500">
        Chargement…
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return <>{children}</>
}
