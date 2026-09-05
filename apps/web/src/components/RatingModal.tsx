import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface RatingModalProps {
  rideId: string
  raterId: string
  raterRole: 'passenger' | 'driver'
  rateeId: string
  rateeName: string | null
  onClose: () => void
}

// Écran #11 (docs/05-ecrans.md, « Fin de course ») — jamais construit
// jusqu'ici malgré une table `ratings` + trigger `apply_rating_to_aggregate`
// prêts depuis la migration 1 (0 ligne en production malgré des courses
// déjà terminées, voir TASK-047). RLS (`ratings_insert_own`) exige
// `ratee_id` exactement égal à `rides.driver_id`/`rides.passenger_id` —
// jamais deviné côté client, toujours lu directement sur la ligne `rides`
// de l'appelant (déjà accordé par RLS, pas besoin d'une RPC dédiée).
export function RatingModal({ rideId, raterId, raterRole, rateeId, rateeName, onClose }: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (rating === 0) {
      setError('Choisissez une note de 1 à 5 étoiles.')
      return
    }
    setError(null)
    setBusy(true)
    const { error: insertError } = await supabase.from('ratings').insert({
      ride_id: rideId,
      rater_id: raterId,
      ratee_id: rateeId,
      rater_role: raterRole,
      rating,
      comment: comment.trim() || null,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onClose()
  }

  const label = raterRole === 'passenger' ? 'le chauffeur' : 'le passager'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-400">Notez {label}</h2>
        <p className="mb-4 text-sm text-ink-600">Course terminée avec {rateeName || label}.</p>

        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`text-3xl ${n <= rating ? 'text-gold-500' : 'text-ink-100'}`}
              aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Un commentaire (optionnel)…"
          className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
        />

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-ink-100 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
          >
            Plus tard
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="flex-1 rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {busy ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}
