import { Link } from '@tanstack/react-router'

export function ComingSoon({ audience }: { audience: 'passager' | 'chauffeur' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-600 text-2xl">🚕</span>
      <h1 className="mt-4 text-2xl font-bold text-ink-900">
        Espace {audience} — bientôt disponible
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-600">
        {audience === 'passager'
          ? "La commande de course en ligne arrive prochainement."
          : "L'espace chauffeur (dossier, disponibilité, courses) arrive prochainement."}
      </p>
      <Link to="/" className="mt-6 text-sm font-medium text-navy-700 hover:underline">
        ← Retour à l'accueil
      </Link>
    </div>
  )
}
