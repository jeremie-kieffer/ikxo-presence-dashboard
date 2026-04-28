// Génère un secret aléatoire pour signer les cookies d'authentification.
// Lancement : node scripts/generer-secret.mjs
//
// Copier la valeur affichée dans Cloudflare Pages :
//   Settings → Environment variables → Add variable
//   Name : COOKIE_SECRET
//   Type : Encrypt
//
// Cette valeur n'a JAMAIS besoin d'être partagée à un humain.
// Elle sert uniquement au serveur pour signer/vérifier les cookies.

import { randomBytes } from "node:crypto"

const secret = randomBytes(32).toString("hex")

console.log()
console.log("  COOKIE_SECRET (à coller dans Cloudflare Pages) :")
console.log()
console.log("  " + secret)
console.log()
console.log("  → Settings → Environment variables → Add variable")
console.log("    Name : COOKIE_SECRET")
console.log("    Value : la valeur ci-dessus")
console.log("    ✓ Encrypt")
console.log()
