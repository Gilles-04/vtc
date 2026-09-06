import type { DriverDocType, DriverRecord } from '../../lib/types'
import { DocStatusBadge } from '../../components/Badge'

const DOC_TYPES: { type: DriverDocType; label: string }[] = [
  { type: 'piece_identite', label: "Pièce d'identité" },
  { type: 'permis_conduire', label: 'Permis de conduire' },
  { type: 'carte_transport', label: 'Carte de transport' },
  { type: 'assurance', label: 'Assurance' },
  { type: 'carte_grise', label: 'Carte grise' },
  { type: 'photo_vehicule', label: 'Photo du véhicule' },
]

export function DocumentsSection({
  driver,
  uploadingType,
  onUpload,
}: {
  driver: DriverRecord
  uploadingType: DriverDocType | null
  onUpload: (docType: DriverDocType, file: File) => void
}) {
  return (
    <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
        Documents ({driver.driver_documents.length}/{DOC_TYPES.length} soumis)
      </h2>
      <div className="space-y-2">
        {DOC_TYPES.map(({ type, label }) => {
          const doc = driver.driver_documents.find((d) => d.doc_type === type)
          return (
            <div key={type} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3">
              <div>
                <p className="text-sm font-medium text-ink-800">{label}</p>
                {doc && (
                  <div className="mt-1 flex items-center gap-2">
                    <DocStatusBadge status={doc.status} />
                    {doc.rejection_reason && <span className="text-xs text-red-600">{doc.rejection_reason}</span>}
                  </div>
                )}
              </div>
              <label className="cursor-pointer rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100">
                {uploadingType === type ? 'Envoi…' : doc ? 'Remplacer' : 'Envoyer'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploadingType !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onUpload(type, file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          )
        })}
      </div>
    </section>
  )
}
