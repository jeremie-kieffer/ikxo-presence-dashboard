import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase-client"

/**
 * Expose l'état d'authentification Supabase à toute l'app.
 *
 * - Au montage : lit la session courante (`getSession`) puis passe `loading` à
 *   false. État initial : `{ user: null, loading: true }`.
 * - S'abonne aux changements (`onAuthStateChange`) — connexion via magic link,
 *   déconnexion, refresh de token — et met `user` à jour en conséquence.
 * - Se désabonne au démontage ; un drapeau `actif` évite un setState après
 *   démontage si `getSession` résout tardivement.
 */
export function useSession(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let actif = true

    supabase.auth.getSession().then(({ data }) => {
      if (!actif) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      actif = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
