import { Modal, Pressable, StyleSheet, Text, View, FlatList } from 'react-native'
import { useState } from 'react'
import { colors } from '../theme'

interface Option {
  value: string
  label: string
}

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder: string
}

// Remplace <select> (HTML) — React Native n'a pas d'équivalent natif.
// Utilisé pour le choix de zone (optionnel) côté demande de course.
export function SelectField({ value, onChange, options, placeholder }: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.valueText : styles.placeholderText}>{selected ? selected.label : placeholder}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                >
                  <Text style={item.value === value ? styles.optionTextSelected : styles.optionText}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  valueText: { fontSize: 15, color: colors.ink900 },
  placeholderText: { fontSize: 15, color: colors.ink400 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 22, 34, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%', paddingVertical: 8 },
  option: { paddingHorizontal: 20, paddingVertical: 14 },
  optionText: { fontSize: 15, color: colors.ink800 },
  optionTextSelected: { fontSize: 15, color: colors.navy600, fontWeight: '600' },
})
