import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

interface ProfileModalProps {
  userId: string
  initialFullName: string | null
  initialLanguage: string
  onClose: () => void
  onSaved: (fullName: string, language: string) => void
}

// Écran transverse Profil/Paramètres (docs/05-ecrans.md) — seules colonnes
// modifiables par le client (migration 1) : full_name, avatar_url, language.
// `is_suspended` et le reste restent réservés aux RPC admin (audit).
export function ProfileModal({ userId, initialFullName, initialLanguage, onClose, onSaved }: ProfileModalProps) {
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [language, setLanguage] = useState(initialLanguage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null, language })
      .eq('id', userId)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onSaved(fullName.trim(), language)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
        <form onSubmit={submit}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Profil</h2>

          <label className="mb-1 block text-sm font-medium text-ink-800">Nom complet</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Votre nom"
            className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
          />

          <label className="mb-1 block text-sm font-medium text-ink-800">Langue</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-800"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>

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
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
