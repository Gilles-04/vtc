import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { DriverDocType, DriverRecord } from '../../lib/types'
import { DocStatusBadge } from '../../components/Badge'
import { colors } from '../../theme'

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
  onUpload: (docType: DriverDocType) => void
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        Documents ({driver.driver_documents.length}/{DOC_TYPES.length} soumis)
      </Text>
      {DOC_TYPES.map(({ type, label }) => {
        const doc = driver.driver_documents.find((d) => d.doc_type === type)
        return (
          <View key={type} style={styles.docRow}>
            <View style={styles.docInfo}>
              <Text style={styles.docLabel}>{label}</Text>
              {doc && (
                <View style={styles.docStatusRow}>
                  <DocStatusBadge status={doc.status} />
                  {doc.rejection_reason && <Text style={styles.docRejection}>{doc.rejection_reason}</Text>}
                </View>
              )}
            </View>
            <Pressable disabled={uploadingType !== null} onPress={() => onUpload(type)} style={styles.uploadButton}>
              <Text style={styles.uploadButtonText}>{uploadingType === type ? 'Envoi…' : doc ? 'Remplacer' : 'Envoyer'}</Text>
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.ink100, borderRadius: 12, padding: 12, marginBottom: 8 },
  docInfo: { flex: 1, marginRight: 12 },
  docLabel: { fontSize: 14, fontWeight: '500', color: colors.ink800 },
  docStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  docRejection: { fontSize: 11, color: colors.red700 },
  uploadButton: { backgroundColor: colors.navy50, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  uploadButtonText: { fontSize: 13, fontWeight: '600', color: colors.navy700 },
})
