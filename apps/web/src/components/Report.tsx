import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

interface ReportModalProps {
  rideId: string | null
  reporterId: string
  categories: { value: string; label: string }[]
  onClose: () => void
}

// Écran #14 (docs/05-ecrans.md) : signaler un comportement lié à une course.
// `reported_user_id` volontairement laissé à null ici — ni PassengerActiveRide
// ni ActiveRide/RideHistoryRow n'exposent l'identité de la contrepartie hors
// RPC dédiée (docs/11-securite.md), et `ride_id` suffit à l'équipe pour
// retrouver les deux parties depuis l'écran admin Réclamations & SOS.
export function ReportModal({ rideId, reporterId, categories, onClose }: ReportModalProps) {
  const [category, setCategory] = useState(categories[0]?.value ?? '')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!description.trim()) {
      setError('Décrivez le problème rencontré.')
      return
    }
    setError(null)
    setBusy(true)
    const { error: insertError } = await supabase.from('reports').insert({
      ride_id: rideId,
      reporter_id: reporterId,
      category,
      description: description.trim(),
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
        {sent ? (
          <>
            <h2 className="mb-2 text-sm font-semibold text-ink-800">Signalement envoyé</h2>
            <p className="mb-4 text-sm text-ink-600">Merci, notre équipe va examiner votre signalement.</p>
            <button onClick={onClose} className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
              Fermer
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Signaler un problème</h2>

            <label className="mb-1 block text-sm font-medium text-ink-800">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-800"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-sm font-medium text-ink-800">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Décrivez ce qui s'est passé…"
              className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
            />

            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-ink-100 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                {busy ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
