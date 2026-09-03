import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Zone } from '../lib/types'
import { Badge } from '../components/Badge'

export function Zones() {
  const [zones, setZones] = useState<Zone[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formNightStart, setFormNightStart] = useState('20:00')
  const [formNightEnd, setFormNightEnd] = useState('05:00')
  const [formError, setFormError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  const load = useCallback(() => {
    setZones(null)
    supabase
      .from('zones')
      .select('id, name, city, night_start_time, night_end_time, is_active, created_at')
      .order('city')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setZones(data as Zone[])
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(zone: Zone) {
    setActionError(null)
    setBusyId(zone.id)
    const { error } = await supabase.from('zones').update({ is_active: !zone.is_active }).eq('id', zone.id)
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function createZone(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!formName.trim() || !formCity.trim()) {
      setFormError('Nom et ville sont obligatoires.')
      return
    }
    setFormBusy(true)
    const { error } = await supabase.from('zones').insert({
      name: formName.trim(),
      city: formCity.trim(),
      night_start_time: formNightStart,
      night_end_time: formNightEnd,
    })
    setFormBusy(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setShowForm(false)
    setFormName('')
    setFormCity('')
    load()
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">Zones</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          {showForm ? 'Annuler' : 'Nouvelle zone'}
        </button>
      </div>

      <p className="mb-4 max-w-2xl text-sm text-ink-400">
        La frontière géographique de chaque zone (dessinée sur une carte) n'est pas encore éditable ici — bloquée par
        la clé API Google Maps, en attente. Les zones créées ici sont fonctionnelles pour la tarification/majoration
        de nuit dès maintenant.
      </p>

      {showForm && (
        <form onSubmit={createZone} className="mb-6 max-w-xl rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Créer une zone</h2>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Nom</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Centre-ville"
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Ville</label>
              <input
                type="text"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Lomé"
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Début majoration nuit</label>
              <input
                type="time"
                value={formNightStart}
                onChange={(e) => setFormNightStart(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Fin majoration nuit</label>
              <input
                type="time"
                value={formNightEnd}
                onChange={(e) => setFormNightEnd(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
          </div>

          {formError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <button
            type="submit"
            disabled={formBusy}
            className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {formBusy ? 'Création…' : 'Créer'}
          </button>
        </form>
      )}

      {(error || actionError) && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error || actionError}
        </div>
      )}

      {!error && zones === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && zones !== null && zones.length === 0 && <p className="text-sm text-ink-400">Aucune zone créée.</p>}

      {!error && zones !== null && zones.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Majoration nuit</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 font-medium text-ink-800">{z.name}</td>
                  <td className="px-4 py-3 text-ink-600">{z.city}</td>
                  <td className="px-4 py-3 text-ink-600">
                    {z.night_start_time.slice(0, 5)} → {z.night_end_time.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={z.is_active ? 'green' : 'default'}>{z.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busyId === z.id}
                      onClick={() => toggleActive(z)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                        z.is_active ? 'text-red-700 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {z.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
