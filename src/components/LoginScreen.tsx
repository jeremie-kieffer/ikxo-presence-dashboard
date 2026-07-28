import { useState } from "react"
import { envoyerMagicLink } from "../lib/auth-helpers"

type MessageResultat = { type: "success" | "error"; text: string } | null

// Restriction appliquée aussi côté DB (trigger PostgreSQL). On la double côté
// front pour une UX immédiate (message sans aller-retour serveur).
const DOMAINE_AUTORISE = "@ikxo.fr"

export function LoginScreen() {
  const [email, setEmail] = useState("")
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [messageResultat, setMessageResultat] = useState<MessageResultat>(null)

  const emailVide = email.trim() === ""

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const valeur = email.trim()
    if (valeur === "") return

    if (!valeur.toLowerCase().endsWith(DOMAINE_AUTORISE)) {
      setMessageResultat({
        type: "error",
        text: "Seuls les emails @ikxo.fr sont autorisés",
      })
      return
    }

    setEnvoiEnCours(true)
    setMessageResultat(null)
    const res = await envoyerMagicLink(valeur)
    if (res.success) {
      setMessageResultat({
        type: "success",
        text: `Un email vient d'être envoyé à ${valeur}. Vérifie ta boîte mail (et tes spams si besoin).`,
      })
      setEmail("")
    } else {
      setMessageResultat({ type: "error", text: messageErreur(res.error) })
    }
    setEnvoiEnCours(false)
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-ikxo-blue">
          Dashboard IKXO
        </h1>
        <p className="mt-1 text-sm font-medium text-gray-700">
          Connexion administrateur
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Renseigne ton email @ikxo.fr, tu recevras un lien de connexion par
          mail.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@ikxo.fr"
            required
            autoFocus
            autoComplete="email"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm outline-none focus:border-ikxo-blue focus:ring-1 focus:ring-ikxo-blue"
          />
          <button
            type="submit"
            disabled={envoiEnCours || emailVide}
            className="w-full rounded-md bg-ikxo-blue px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ikxo-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {envoiEnCours ? "Envoi en cours…" : "Recevoir mon lien magique"}
          </button>
        </form>

        {messageResultat && (
          <div
            className={
              messageResultat.type === "success"
                ? "mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                : "mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            }
          >
            {messageResultat.text}
          </div>
        )}
      </div>
    </div>
  )
}

// Traduit l'erreur brute de Supabase en message actionnable. Le rejet de domaine
// (@ikxo.fr) est déjà intercepté côté front avant l'appel, donc il n'a pas à
// être remappé ici. On distingue le rate-limit et le cas « email inconnu »
// (signup désactivé : l'adresse n'est pas un compte admin provisionné) ; tout
// le reste retombe sur le message brut de Supabase.
function messageErreur(brut?: string): string {
  const e = (brut ?? "").toLowerCase()
  if (/rate limit|too many|429/.test(e)) {
    return "Trop de tentatives, réessaye dans quelques minutes"
  }
  if (/signup|not allowed for this instance/.test(e)) {
    return "Aucun compte administrateur associé à cet email."
  }
  return brut && brut.trim() !== "" ? brut : "Une erreur est survenue, réessaye."
}
