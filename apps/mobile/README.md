# App Mobile (Android + iOS)

Application mobile React Native (Expo SDK 57, TypeScript, [Expo Router](https://docs.expo.dev/router/introduction/)
pour la navigation par fichiers) — un seul code pour Android et iOS et pour
les deux rôles, passager et chauffeur, avec bascule de mode dès l'accueil
(pas de connexion préalable requise pour choisir son rôle).

Remplace `apps/passenger`/`apps/driver` (rôles séparés, un binaire chacun)
suite à la révision d'architecture du 3 septembre 2026 — voir
[`../../docs/02-architecture-technique.md`](../../docs/02-architecture-technique.md)
§Révision du 3 septembre 2026.

## État actuel — Phase 1 du plan (auth uniquement)

Démarré le 4 septembre 2026, en **Phase 1** de
[`../../docs/12-roadmap.md`](../../docs/12-roadmap.md) — authentification
et profils, avant tout écran métier. Volontairement limité à ce
périmètre : les phases suivantes (KYC chauffeur, abonnement, demande de
course...) sont déjà construites et vérifiées côté `apps/web` et seront
portées ici progressivement, pas construites deux fois en parallèle.

Construit et vérifié réellement (voir §Vérification ci-dessous) :
- Écran d'accueil avec bascule de rôle (passager / chauffeur), même
  copie/palette que `apps/web`.
- Authentification par code email en deux étapes (`signInWithOtp` /
  `verifyOtp`), un composant partagé (`src/components/EmailOtpAuth.tsx`)
  pour les deux rôles — port direct de `PassengerLogin.tsx`/`DriverLogin.tsx`
  (`apps/web`), même logique, UI native.
- Garde de session : `/passager/accueil` et `/chauffeur/accueil`
  redirigent vers l'écran de connexion correspondant si aucune session
  active ; `/passager` et `/chauffeur` redirigent vers l'accueil connecté
  si une session existe déjà.
- Accueils passager/chauffeur : stubs volontaires (« bientôt disponible »)
  — le contenu réel existe déjà côté `apps/web`
  (`PassengerHome.tsx`/`DriverHome.tsx`) et sera porté dans une prochaine
  tâche, pas dupliqué à la va-vite ici.

**Non fait ici** (prochaines tâches, pas des oublis) : tableau de bord
chauffeur (KYC, abonnement, disponibilité, offres, course en cours),
demande de course passager, notifications push, géolocalisation en
arrière-plan. Tout cela dépend en plus des fondations de la Phase 0
(clé Google Maps, compte Expo/EAS pour les builds — voir
[`../../docs/STATUS.md`](../../docs/STATUS.md) §7) qui ne sont pas encore
en place.

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
développement de cette tâche — vérifié via `expo start --web` (Metro
bundle react-native-web) et un vrai navigateur (Playwright/Chromium) :
navigation accueil → connexion passager/chauffeur, formulaire d'email
soumis (appel réel `signInWithOtp`, a échoué sur le réseau sandboxé sans
accès sortant vers `*.supabase.co` — comportement attendu, l'écran affiche
alors une erreur claire au lieu de planter), gardes de session sur les
deux routes `/accueil` (redirection vers la connexion sans session
active). `tsc --noEmit` et `oxlint` propres. **Non vérifié** : rendu natif
réel sur un simulateur/appareil Android ou iOS — à faire une fois un
environnement avec Expo Go ou un simulateur disponible.

## Structure

```
app/                      # routes (expo-router — un fichier = une route)
  _layout.tsx              # layout racine (Stack, StatusBar)
  index.tsx                 # accueil / choix du rôle
  passager/
    index.tsx                # connexion passager (email OTP)
    accueil.tsx               # accueil passager (stub)
  chauffeur/
    index.tsx                # connexion chauffeur (email OTP)
    accueil.tsx               # accueil chauffeur (stub)
src/
  lib/supabase.ts           # client Supabase (AsyncStorage, même clé publique que apps/web)
  components/EmailOtpAuth.tsx  # formulaire de connexion partagé passager/chauffeur
  theme.ts                   # tokens de couleur (identiques à apps/web/apps/admin)
```
