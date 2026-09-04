# App Mobile (Android + iOS)

Application mobile React Native (Expo SDK 57, TypeScript, [Expo Router](https://docs.expo.dev/router/introduction/)
pour la navigation par fichiers) — un seul code pour Android et iOS et pour
les deux rôles, passager et chauffeur, avec bascule de mode dès l'accueil
(pas de connexion préalable requise pour choisir son rôle).

Remplace `apps/passenger`/`apps/driver` (rôles séparés, un binaire chacun)
suite à la révision d'architecture du 3 septembre 2026 — voir
[`../../docs/02-architecture-technique.md`](../../docs/02-architecture-technique.md)
§Révision du 3 septembre 2026.

## État actuel

Démarré le 4 septembre 2026 (Phase 1 du plan — auth) puis complété le même
jour avec le tableau de bord chauffeur et la demande de course passager,
portés depuis `apps/web` (mêmes RPC/Edge Function, même logique métier,
uniquement la couche présentation change). Voir
[`../../docs/12-roadmap.md`](../../docs/12-roadmap.md).

Construit et vérifié réellement (voir §Vérification ci-dessous) :
- Écran d'accueil avec bascule de rôle (passager / chauffeur), même
  copie/palette que `apps/web`.
- Authentification par code email en deux étapes (`signInWithOtp` /
  `verifyOtp`), un composant partagé (`src/components/EmailOtpAuth.tsx`)
  pour les deux rôles — port direct de `PassengerLogin.tsx`/`DriverLogin.tsx`.
- Garde de session sur les 4 routes (connexion ↔ accueil dans les deux
  sens, selon la présence d'une session).
- **Tableau de bord chauffeur** (`app/chauffeur/accueil.tsx`, port de
  `DriverHome.tsx`) : onboarding (`DriverOnboarding.tsx`, catégorie/ville/
  véhicule → `submit_driver_application`), dépôt de documents (sélecteur
  de fichier natif `expo-file-system` `File.pickFileAsync` + upload
  Storage via `.arrayBuffer()` — pas de dépendance `expo-document-picker`
  séparée, l'API native suffit), section abonnement (achat en mode
  manuel), bascule disponibilité, offres de course en attente (Realtime),
  course en cours jusqu'à `complete_ride`.
- **Demande de course passager** (`app/passager/accueil.tsx`, port de
  `PassengerHome.tsx`) : suivi de la course en cours (infos publiques du
  chauffeur une fois matché, annulation), formulaire de demande (catégorie,
  adresses avec coordonnées saisies à la main en attendant Google Places,
  zone optionnelle via `SelectField` — un picker modal, React Native n'a
  pas de `<select>` — mode de paiement, estimation via l'Edge Function
  `pricing-directions` puis `create_ride_request`), historique.

**Limitation connue, spécifique au mode web de vérification** :
`Alert.alert()` (React Native) est un no-op complet sur `react-native-web`
(confirmé en lisant sa source — pas de dialogue, aucun callback de bouton
n'est jamais appelé). Trois confirmations de l'app en dépendent : l'achat
d'un abonnement, « le passager a-t-il payé en espèces ? » à la clôture
d'une course, et l'annulation d'une course. Sur un appareil/simulateur
réel (iOS/Android), `Alert.alert` fonctionne normalement — c'est une
limitation du mode web utilisé ici pour vérifier faute d'émulateur, pas
un défaut de l'app. Vérifié en conséquence : les chemins non bloqués par
`Alert` (accepter/refuser une offre, signaler l'arrivée, démarrer la
course, terminer une course Mobile Money) de bout en bout ; les chemins
bloqués par `Alert` (achat d'abonnement, confirmation cash, annulation)
seulement jusqu'au moment où `Alert.alert` est appelé — à revérifier sur
un appareil réel.

## Développement local

```sh
npm install               # depuis la racine du monorepo, ou ici (workspace npm)
cp .env.example .env      # renseigner EXPO_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY
npx expo start            # scanner le QR code avec l'app Expo Go (Android/iOS)
npx expo start --web      # ou tester dans un navigateur, sans app mobile
```

`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` est la même clé publique que
`VITE_SUPABASE_PUBLISHABLE_KEY` dans `apps/web`/`apps/admin` — sûre côté
client, jamais la clé `service_role`.

Aucun compte Expo/EAS requis pour le développement local (Expo Go ou le
mode web suffisent) — seulement pour un build natif installable
(`eas build`) ou une publication sur les stores, plus tard.

## Vérification effectuée (4 septembre 2026)

Pas d'émulateur Android/iOS disponible dans l'environnement de
développement de cette tâche (pas de SDK Android, pas d'Xcode — sandbox
Linux) — vérifié via `expo start --web` (Metro bundle react-native-web)
et un vrai navigateur (Playwright/Chromium), avec mocks REST/RPC réalistes
et une session simulée (le stockage web par défaut d'`AsyncStorage` est un
simple wrapper `window.localStorage`, confirmé en lisant sa source — la
même technique de session simulée que pour `apps/web` s'applique donc
telle quelle) :

- Auth + gardes de session : navigation accueil → connexion, appel réel
  `signInWithOtp` déclenché (échec propre sur le réseau sandboxé, attendu),
  gardes de session testées sans session active dans les deux sens.
- Chauffeur : onboarding (formulaire rendu), documents (section rendue
  avec le bon décompte et les bons statuts, l'upload lui-même — sélecteur
  de fichier natif — non déclenché depuis ce mode), abonnement actif,
  disponibilité, offre de course acceptée → passager affiché → arrivée
  signalée → course démarrée → course terminée (Mobile Money, pour
  rester sur un chemin non bloqué par `Alert.alert`, voir limitation
  ci-dessus).
- Passager : formulaire de demande, `SelectField` (zone) ouvert et une
  option sélectionnée, erreur claire si tarification non configurée,
  estimation puis confirmation de la demande, carte de suivi affichée,
  historique affiché.

`tsc --noEmit` et `oxlint` propres. **Non vérifié** : rendu natif réel sur
un simulateur/appareil Android ou iOS, upload de document réel, et les
trois confirmations `Alert.alert` (§Limitation connue ci-dessus) — à
faire une fois un environnement avec Expo Go ou un simulateur disponible.

## Structure

```
app/                      # routes (expo-router — un fichier = une route)
  _layout.tsx              # layout racine (Stack, StatusBar)
  index.tsx                 # accueil / choix du rôle
  passager/
    index.tsx                # connexion passager (email OTP)
    accueil.tsx               # demande de course + suivi + historique
  chauffeur/
    index.tsx                # connexion chauffeur (email OTP)
    accueil.tsx               # tableau de bord (documents/abonnement/offres/course)
src/
  lib/
    supabase.ts              # client Supabase (AsyncStorage, même clé publique que apps/web)
    types.ts, format.ts       # copiés depuis apps/web (TS pur, agnostique de la plateforme)
  components/
    EmailOtpAuth.tsx           # formulaire de connexion partagé passager/chauffeur
    DriverOnboarding.tsx        # formulaire catégorie/ville/véhicule
    Badge.tsx                    # badges de statut (port de apps/web/components/Badge.tsx)
    SelectField.tsx               # picker modal (remplace <select>, utilisé pour la zone)
  theme.ts                   # tokens de couleur (identiques à apps/web/apps/admin)
```
