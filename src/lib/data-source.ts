/**
 * Point d'entrée unique pour le chargement des données du dashboard.
 *
 * Toute l'application passe par `chargerDonnees()` : la provenance réelle des
 * données (Supabase aujourd'hui, xlsx hier, cache ou mock demain) est un détail
 * d'implémentation isolé ici. Pour changer de source (rollback, cache, tests),
 * on ne modifie que ce fichier — App.tsx et les vues restent inchangés.
 */
import { fetchDashboardData } from "./supabase-fetchers"
import type { DashboardData } from "./types"

export async function chargerDonnees(): Promise<DashboardData> {
  return fetchDashboardData()
}
