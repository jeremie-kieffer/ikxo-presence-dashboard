import { useEffect } from "react"

/**
 * Toast de feedback éphémère, positionné en haut à droite.
 * Auto-fermeture après 3 s ; `onClose` remonte au parent pour réinitialiser
 * son état.
 */
export function Toast({
  type,
  message,
  onClose,
}: {
  type: "success" | "error"
  message: string
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const couleurs =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800"

  return (
    <div
      role="status"
      className={`fixed right-4 top-4 z-50 max-w-sm rounded-md border px-4 py-2.5 text-sm shadow-md ${couleurs}`}
    >
      {message}
    </div>
  )
}
