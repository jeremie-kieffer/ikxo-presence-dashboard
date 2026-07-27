/**
 * Client Supabase pour le dashboard React.
 *
 * Expose une instance `supabase` unique, initialisée à partir des variables
 * d'environnement Vite (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
 *
 * La clé utilisée ici est la clé *publishable* (anon) : elle est destinée à
 * être exposée côté navigateur et peut donc figurer sans risque dans le bundle
 * front. Ne jamais utiliser la `service_role` ici — elle doit rester serveur.
 *
 * Ce module ne contient que la connexion : les fetch et les transformations
 * métier vivent dans un fichier séparé (substep 4.3).
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Validation fail-fast : on préfère une erreur explicite au démarrage plutôt
// qu'un client à moitié initialisé qui échouerait de façon opaque au 1er fetch.
if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies dans .env',
  )
}

export const supabase = createClient(url, anonKey)
