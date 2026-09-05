import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

export function PassengerLogin() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'intro' | 'email' | 'code' | 'profile'>('intro')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [language, setLanguage] = useState('fr')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setStep('code')
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data: verifyData, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) {
      setLoading(false)
      setError(error.message === 'Token has expired or is invalid' ? 'Code incorrect ou expiré.' : error.message)
      return
    }

    // Écran #4 (docs/05-ecrans.md) : uniquement pour un tout nouveau compte —
    // `handle_new_user` (migration 1) crée le profil sans jamais renseigner
    // `full_name`, un profil existant l'a forcément déjà (ce formulaire ou
    // l'écran Profil transverse) une fois passé ici une première fois.
    const uid = verifyData.user?.id
    const { data: profile } = uid
      ? await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle()
      : { data: null }
    setLoading(false)
    if (!profile?.full_name) {
      setStep('profile')
      return
    }
    navigate({ to: '/passager/accueil' })
  }

  async function handleSubmitProfile(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null, language }).eq('id', uid)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate({ to: '/passager/accueil' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-600 text-2xl">
            🧍
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Espace passager</h1>
          <p className="mt-1 text-sm text-ink-600">
            {step === 'intro' && 'Réservez une course en quelques secondes, à Lomé.'}
            {step === 'email' && 'Connectez-vous avec votre email'}
            {step === 'code' && 'Entrez le code reçu par email'}
            {step === 'profile' && 'Bienvenue — quelques informations avant de commencer'}
          </p>
        </div>

        {step === 'intro' && (
          <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm text-ink-600">
              VTC Togo vous met en relation avec un chauffeur voiture ou moto-taxi, avec un prix connu avant de
              commander.
            </p>
            <button
              onClick={() => setStep('email')}
              className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700"
            >
              Continuer
            </button>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendCode} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <label className="mb-1 block text-sm font-medium text-ink-800">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              placeholder="vous@exemple.com"
            />

            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Recevoir le code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm text-ink-600">
              Un code a été envoyé à <span className="font-medium text-ink-900">{email}</span>.
            </p>
            <label className="mb-1 block text-sm font-medium text-ink-800">Code</label>
            <input
              type="text"
              inputMode="numeric"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              placeholder="000000"
            />

            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
            >
              {loading ? 'Vérification...' : 'Valider'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
              className="mt-3 w-full text-center text-sm text-ink-600 hover:underline"
            >
              Changer d'email
            </button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleSubmitProfile} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <label className="mb-1 block text-sm font-medium text-ink-800">Votre nom</label>
            <input
              type="text"
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex : Ama Koffi"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Commencer'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-ink-400">
          <Link to="/" className="hover:underline">
            ← Retour à l'accueil
          </Link>
        </p>
      </div>
    </div>
  )
}
