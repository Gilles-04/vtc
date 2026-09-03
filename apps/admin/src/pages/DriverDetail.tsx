import { useCallback, useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { DriverDetail as DriverDetailRow, DriverDocType } from '../lib/types'
import { DriverStatusBadge, CategoryBadge, Badge } from '../components/Badge'

const DOC_TYPE_LABELS: Record<DriverDocType, string> = {
  piece_identite: "Pièce d'identité",
  permis_conduire: 'Permis de conduire',
  carte_transport: 'Carte de transport',
  assurance: 'Assurance',
  carte_grise: 'Carte grise',
  photo_vehicule: 'Photo du véhicule',
}

export function DriverDetail() {
  const { driverId } = useParams({ from: '/chauffeurs/$driverId' })
  const [driver, setDriver] = useState<DriverDetailRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setDriver(null)
    setDocUrls({})
    supabase
      .from('drivers')
      .select(
        'id, category, status, city, rating_avg, rating_count, total_rides, created_at, profiles(phone, full_name), vehicles(*), driver_documents(*)',
      )
      .eq('id', driverId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message)
          return
        }
        const row = data as unknown as DriverDetailRow
        setDriver(row)
        for (const doc of row.driver_documents) {
          supabase.storage
            .from('driver-documents')
            .createSignedUrl(doc.file_path, 300)
            .then(({ data: signed }) => {
              if (signed?.signedUrl) {
                setDocUrls((prev) => ({ ...prev, [doc.id]: signed.signedUrl }))
              }
            })
        }
      })
  }, [driverId])

  useEffect(() => {
    load()
  }, [load])

  async function reviewDocument(documentId: string, decision: 'approved' | 'rejected') {
    setActionError(null)
    let reason: string | null = null
    if (decision === 'rejected') {
      reason = window.prompt('Motif du rejet (visible par le chauffeur) :')
      if (reason === null) return
    }
    setBusy(true)
    const { error } = await supabase.rpc('admin_review_driver_document', {
      _document_id: documentId,
      _decision: decision,
      _reason: reason,
    })
    setBusy(false)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function decideApplication(decision: 'approved' | 'rejected') {
    setActionError(null)
    let reason: string | null = null
    if (decision === 'rejected') {
      reason = window.prompt('Motif du refus (visible par le chauffeur) :')
      if (reason === null) return
    }
    if (!window.confirm(decision === 'approved' ? 'Valider ce dossier chauffeur ?' : 'Refuser ce dossier chauffeur ?')) {
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc('admin_decide_driver_application', {
      _driver_id: driverId,
      _decision: decision,
      _reason: reason,
    })
    setBusy(false)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  if (!driver) {
    return <p className="p-8 text-sm text-ink-400">Chargement…</p>
  }

  const vehicle = driver.vehicles[0]

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">
            {driver.profiles?.full_name || driver.profiles?.phone || driver.id.slice(0, 8)}
          </h1>
          <p className="mt-1 text-sm text-ink-600">{driver.profiles?.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge category={driver.category} />
          <DriverStatusBadge status={driver.status} />
        </div>
      </div>

      {actionError && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard label="Ville" value={driver.city || '—'} />
        <InfoCard label="Note" value={driver.rating_count > 0 ? `${driver.rating_avg.toFixed(1)} (${driver.rating_count})` : '—'} />
        <InfoCard label="Courses" value={String(driver.total_rides)} />
        <InfoCard label="Inscrit le" value={new Date(driver.created_at).toLocaleDateString('fr-FR')} />
      </section>

      <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Véhicule</h2>
        {vehicle ? (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <InfoCard label="Marque / modèle" value={`${vehicle.brand} ${vehicle.model}`} />
            <InfoCard label="Couleur" value={vehicle.color} />
            <InfoCard label="Plaque" value={vehicle.plate_number} />
            <InfoCard label="Année" value={vehicle.year ? String(vehicle.year) : '—'} />
          </div>
        ) : (
          <p className="text-sm text-ink-400">Aucun véhicule renseigné.</p>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Documents</h2>
        {driver.driver_documents.length === 0 && <p className="text-sm text-ink-400">Aucun document soumis.</p>}
        <div className="space-y-3">
          {driver.driver_documents.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 p-3">
              <div>
                <p className="text-sm font-medium text-ink-800">{DOC_TYPE_LABELS[doc.doc_type]}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={doc.status === 'approved' ? 'green' : doc.status === 'rejected' ? 'red' : 'gold'}>
                    {doc.status === 'approved' ? 'Approuvé' : doc.status === 'rejected' ? 'Rejeté' : 'En attente'}
                  </Badge>
                  {doc.rejection_reason && <span className="text-xs text-red-600">{doc.rejection_reason}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {docUrls[doc.id] && (
                  <a
                    href={docUrls[doc.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100"
                  >
                    Voir
                  </a>
                )}
                <button
                  disabled={busy}
                  onClick={() => reviewDocument(doc.id, 'approved')}
                  className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  Approuver
                </button>
                <button
                  disabled={busy}
                  onClick={() => reviewDocument(doc.id, 'rejected')}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(driver.status === 'pending_review' || driver.status === 'pending_documents') && (
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Décision sur le dossier</h2>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => decideApplication('approved')}
              className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              Valider le dossier
            </button>
            <button
              disabled={busy}
              onClick={() => decideApplication('rejected')}
              className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Refuser le dossier
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  )
}
