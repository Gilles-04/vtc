import { useMemo, useRef, useState, type ComponentType, type RefAttributes } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import RNWebView, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview'
import * as Location from 'expo-location'
import { colors } from '../theme'

// `WebView<P = undefined> extends Component<WebViewProps & P>` — utilisé
// tel quel en JSX, `P` reste `undefined` et `WebViewProps & undefined`
// résout en `never` (bug de typage connu de cette lib avec les types React
// récents). Recast une seule fois ici plutôt qu'à chaque usage.
const WebView = RNWebView as unknown as ComponentType<WebViewProps & RefAttributes<RNWebView>>

export interface LocationValue {
  address: string
  lat: string
  lng: string
}

interface LocationPickerProps {
  label: string
  placeholder: string
  value: LocationValue
  onChange: (value: LocationValue) => void
  // Centre initial de la carte tant qu'aucune position n'est encore choisie
  // (ex : la position de départ déjà sélectionnée, pour le picker de
  // destination) — sinon Lomé par défaut.
  initialCenter?: { lat: number; lng: number }
}

const LOME_CENTER = { lat: 6.1319, lng: 1.2228 }
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY

// Port de apps/web/src/components/LocationPicker.tsx — même besoin
// (adresses/coordonnées peu maîtrisées au Togo, TASK-043), mais via une
// WebView plutôt qu'un <div> DOM : react-native-maps demanderait un
// rebuild natif hors du workflow Expo Go géré ici. Le HTML embarqué
// charge le même Maps JavaScript API que la version web, avec la même
// clé cliente. « Ma position » utilise expo-location (déjà une
// dépendance, gestion de permission déjà éprouvée ailleurs dans ce
// projet) puis pousse la position dans la WebView via `postMessage`,
// plutôt que de gérer la géolocalisation depuis l'intérieur de la
// WebView (permissions plus fragiles à câbler côté react-native-webview).
function buildHtml(center: { lat: number; lng: number }): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body,#map{height:100%;margin:0;padding:0;}</style>
</head>
<body>
<div id="map"></div>
<script>
  var map, marker;
  function post(lat, lng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
  }
  function init() {
    var start = { lat: ${center.lat}, lng: ${center.lng} };
    map = new google.maps.Map(document.getElementById('map'), {
      center: start, zoom: 15, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy'
    });
    marker = new google.maps.Marker({ map: map, position: start, draggable: true });
    marker.addListener('dragend', function() {
      var p = marker.getPosition();
      post(p.lat(), p.lng());
    });
    map.addListener('click', function(e) {
      marker.setPosition(e.latLng);
      post(e.latLng.lat(), e.latLng.lng());
    });
  }
  function setPosition(lat, lng) {
    if (!map || !marker) return;
    var pos = { lat: lat, lng: lng };
    marker.setPosition(pos);
    map.panTo(pos);
    map.setZoom(16);
  }
  function handleMessage(data) {
    try {
      var msg = JSON.parse(data);
      if (msg.type === 'setPosition') setPosition(msg.lat, msg.lng);
    } catch (e) {}
  }
  document.addEventListener('message', function(e) { handleMessage(e.data); });
  window.addEventListener('message', function(e) { handleMessage(e.data); });
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async&callback=init"></script>
</body>
</html>`
}

export function LocationPicker({ label, placeholder, value, onChange, initialCenter }: LocationPickerProps) {
  const webviewRef = useRef<RNWebView>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Généré une seule fois au montage — les mises à jour de position
  // passent ensuite par `postMessage` (voir sendToWebView), jamais en
  // régénérant le HTML (rechargerait toute la carte).
  const html = useMemo(() => {
    const start =
      value.lat && value.lng ? { lat: Number(value.lat), lng: Number(value.lng) } : (initialCenter ?? LOME_CENTER)
    return buildHtml(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { lat: number; lng: number }
      onChange({ address: value.address, lat: String(data.lat), lng: String(data.lng) })
    } catch {
      // message non-JSON — ignoré
    }
  }

  function sendToWebView(lat: number, lng: number) {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'setPosition', lat, lng }))
  }

  async function useMyLocation() {
    setLocationError(null)
    setLocating(true)
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      setLocating(false)
      setLocationError('Autorisation de localisation refusée — choisissez un point sur la carte.')
      return
    }
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLocating(false)
      // Une géolocalisation explicitement demandée remplace une éventuelle
      // adresse tapée à la main — contrairement au clic/glisser sur la
      // carte, qui la préserve (voir handleMessage).
      onChange({ address: '', lat: String(position.coords.latitude), lng: String(position.coords.longitude) })
      sendToWebView(position.coords.latitude, position.coords.longitude)
    } catch {
      setLocating(false)
      setLocationError('Position indisponible — choisissez un point sur la carte.')
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Pressable onPress={useMyLocation} disabled={locating}>
          <Text style={styles.locateText}>{locating ? 'Localisation…' : '📍 Ma position'}</Text>
        </Pressable>
      </View>
      <TextInput
        value={value.address}
        onChangeText={(text) => onChange({ ...value, address: text })}
        placeholder={placeholder}
        placeholderTextColor={colors.ink400}
        style={styles.input}
      />
      <View style={styles.mapWrap}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          javaScriptEnabled
          style={styles.webview}
        />
      </View>
      <Text style={styles.hint}>Touchez la carte ou faites glisser le repère pour ajuster le point exact.</Text>
      {locationError && <Text style={styles.errorText}>{locationError}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink800 },
  locateText: { fontSize: 12, fontWeight: '600', color: colors.navy600 },
  input: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink900,
    marginBottom: 8,
  },
  mapWrap: { height: 192, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink100 },
  webview: { flex: 1 },
  hint: { marginTop: 4, fontSize: 11, color: colors.ink400 },
  errorText: { marginTop: 4, fontSize: 11, color: colors.red700 },
})
