import { Link } from '@tanstack/react-router'

export function Home() {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="flex items-center gap-2 px-6 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-600 text-lg">🚕</span>
        <span className="font-display text-lg font-bold text-ink-900">VTC Togo</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 text-center sm:py-20">
        <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">
          Votre course, en un clic — voiture ou moto-taxi
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-600">
          Commandez directement depuis votre navigateur, sans avoir besoin d'installer une
          application — utile depuis un cybercafé ou un ordinateur partagé.
        </p>

        <div className="mx-auto mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
          <Link
            to="/passager"
            className="rounded-2xl border border-ink-100 bg-white p-6 text-left shadow-sm transition hover:border-navy-500 hover:shadow-md"
          >
            <span className="text-2xl">🧍</span>
            <h2 className="mt-3 text-lg font-semibold text-ink-900">Je suis passager</h2>
            <p className="mt-1 text-sm text-ink-600">Commander une course maintenant</p>
          </Link>

          <Link
            to="/chauffeur"
            className="rounded-2xl border border-ink-100 bg-white p-6 text-left shadow-sm transition hover:border-gold-500 hover:shadow-md"
          >
            <span className="text-2xl">🚗</span>
            <h2 className="mt-3 text-lg font-semibold text-ink-900">Je suis chauffeur</h2>
            <p className="mt-1 text-sm text-ink-600">Accéder à mon espace chauffeur</p>
          </Link>
        </div>
      </main>
    </div>
  )
}
