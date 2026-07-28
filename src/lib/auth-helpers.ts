import { supabase } from "./supabase-client"

/**
 * Envoie un magic link de connexion à l'adresse fournie. Le lien redirige vers
 * l'origine courante de l'app. La restriction @ikxo.fr est appliquée côté
 * Supabase (trigger PostgreSQL), donc une adresse hors domaine échouera là-bas.
 *
 * Retourne un résultat exploitable côté UI plutôt que de lever : `success`
 * false + `error` (message Supabase) en cas d'échec.
 */
export async function envoyerMagicLink(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Déconnecte l'utilisateur courant (efface la session locale). */
export async function deconnecter(): Promise<void> {
  await supabase.auth.signOut()
}
