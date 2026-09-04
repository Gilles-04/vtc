import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { DriverCategory } from '../lib/types'

export function DriverOnboarding({ onSubmitted }: { onSubmitted: () => void }) {
  const [category, setCategory] = useState<DriverCategory>('car')
  const [city, setCity] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [plate, setPlate] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!city.trim() || !brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      setError('Tous les champs sont obligatoires (sauf année).')
      return
    }
    setLoading(true)
    const { error } = await supabase.rpc('submit_driver_application', {
      _category: category,
      _city: city.trim(),
      _vehicle_brand: brand.trim(),
      _vehicle_model: model.trim(),
      _vehicle_color: color.trim(),
      _vehicle_plate: plate.trim(),
      _vehicle_year: year ? Number(year) : null,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    onSubmitted()
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-xl font-bold text-ink-900">Devenir chauffeur</h1>
      <p className="mb-6 text-sm text-ink-600">
        Renseignez votre véhicule pour commencer — les documents (pièce d'identité, permis...) se
        soumettent à l'étape suivante.
      </p>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-ink-800">Catégorie</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCategory('car')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              category === 'car' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            🚗 Voiture
          </button>
          <button
            type="button"
            onClick={() => setCategory('moto')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              category === 'moto' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            🏍️ Moto-taxi
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-ink-800">Ville</label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Lomé"
          className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Marque</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Modèle</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Couleur</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Année</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
            />
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium text-ink-800">Plaque d'immatriculation</label>
        <input
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
        />

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {loading ? 'Envoi...' : 'Continuer'}
        </button>
      </form>
    </div>
  )
}
