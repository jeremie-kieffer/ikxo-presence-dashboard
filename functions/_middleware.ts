// Middleware Cloudflare Pages : protège l'intégralité du site (HTML, JS, CSS,
// fichier Excel) derrière un mot de passe partagé. Cookie d'auth signé HMAC,
// stateless, valide 24h. Comparaison à temps constant pour éviter le timing.

interface Env {
  DASHBOARD_PASSWORD: string
  COOKIE_SECRET: string
}

interface Context {
  request: Request
  env: Env
  next: () => Promise<Response>
}

const COOKIE_NAME = "ikxo_auth"
const COOKIE_MAX_AGE_SEC = 24 * 60 * 60 // 24 h
const ROUTE_LOGIN = "/api/login"

export const onRequest = async (ctx: Context): Promise<Response> => {
  const url = new URL(ctx.request.url)

  // 1) Soumission du formulaire de login : on ne bloque pas, on traite.
  if (url.pathname === ROUTE_LOGIN && ctx.request.method === "POST") {
    return handleLogin(ctx.request, ctx.env)
  }

  // 2) Pour tout le reste : vérifier le cookie.
  const cookie = lireCookie(ctx.request, COOKIE_NAME)
  if (cookie && (await verifierCookie(cookie, ctx.env.COOKIE_SECRET))) {
    return ctx.next() // laisse Cloudflare servir le fichier statique demandé
  }

  // 3) Pas authentifié : sert la page de login.
  const erreur = url.searchParams.get("erreur") === "1"
  return new Response(pageLoginHtml(erreur), {
    status: 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

async function handleLogin(req: Request, env: Env): Promise<Response> {
  const formData = await req.formData()
  const passwordSaisi = String(formData.get("password") ?? "")

  // Comparaison à temps constant : même temps de réponse pour une valeur juste
  // ou fausse, pour éviter qu'un attaquant déduise des caractères.
  const ok =
    passwordSaisi.length > 0 &&
    egaliteTempsConstant(passwordSaisi, env.DASHBOARD_PASSWORD)

  if (!ok) {
    return Response.redirect(new URL("/?erreur=1", req.url).toString(), 303)
  }

  const cookieValue = await signerCookie(env.COOKIE_SECRET)
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": [
        `${COOKIE_NAME}=${cookieValue}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Path=/",
        `Max-Age=${COOKIE_MAX_AGE_SEC}`,
      ].join("; "),
    },
  })
}

// === Signature et vérification du cookie ===
// Format : `${expiresMs}.${HMAC-SHA256(SECRET, expiresMs)}`
// Stateless : on n'a rien à stocker côté serveur, le cookie s'auto-vérifie.

async function signerCookie(secret: string): Promise<string> {
  const expires = Date.now() + COOKIE_MAX_AGE_SEC * 1000
  const sig = await hmacHex(secret, String(expires))
  return `${expires}.${sig}`
}

async function verifierCookie(
  cookie: string,
  secret: string,
): Promise<boolean> {
  const idx = cookie.indexOf(".")
  if (idx === -1) return false
  const expiresStr = cookie.slice(0, idx)
  const sig = cookie.slice(idx + 1)

  const sigAttendue = await hmacHex(secret, expiresStr)
  if (!egaliteTempsConstant(sig, sigAttendue)) return false

  const expires = Number(expiresStr)
  if (!Number.isFinite(expires) || expires < Date.now()) return false
  return true
}

// === Crypto via Web Crypto API (native dans les Workers) ===

async function hmacHex(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function egaliteTempsConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function lireCookie(req: Request, nom: string): string | null {
  const header = req.headers.get("Cookie")
  if (!header) return null
  for (const morceau of header.split(";")) {
    const trimmed = morceau.trim()
    if (trimmed.startsWith(`${nom}=`)) return trimmed.slice(nom.length + 1)
  }
  return null
}

// === Page de login servie quand pas authentifié ===

function pageLoginHtml(erreur: boolean): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard de présence — IKXO</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        color: #0f172a;
        padding: 1.5rem;
      }
      .card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 2rem;
        width: 100%;
        max-width: 360px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }
      h1 {
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0 0 0.25rem;
        color: #0f172a;
      }
      p.subtitle {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0 0 1.5rem;
      }
      label {
        display: block;
        font-size: 0.75rem;
        font-weight: 500;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.375rem;
      }
      input[type="password"] {
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.9375rem;
        font-family: inherit;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      input[type="password"]:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
      button {
        margin-top: 1rem;
        width: 100%;
        padding: 0.5rem 1rem;
        font-size: 0.9375rem;
        font-weight: 500;
        font-family: inherit;
        color: white;
        background: #0f172a;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s;
      }
      button:hover { background: #1e293b; }
      .erreur {
        margin-top: 1rem;
        padding: 0.5rem 0.75rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 6px;
        color: #991b1b;
        font-size: 0.875rem;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Dashboard de présence — IKXO</h1>
      <p class="subtitle">Accès restreint. Saisissez le mot de passe partagé.</p>
      <form method="POST" action="${ROUTE_LOGIN}" autocomplete="off">
        <label for="password">Mot de passe</label>
        <input id="password" name="password" type="password" autofocus required />
        <button type="submit">Accéder</button>
        ${erreur ? '<div class="erreur" role="alert">Mot de passe incorrect.</div>' : ""}
      </form>
    </main>
  </body>
</html>`
}
