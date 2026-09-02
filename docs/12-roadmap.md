# 12 — Roadmap de développement

Construction **progressive**, jamais tout en une fois — principe explicite
du cadrage (§13). Chaque étape doit être fonctionnelle et vérifiable avant
de passer à la suivante.

## Phase 0 — Fondations (avant toute fonctionnalité visible)

- Projet Supabase dédié créé, schéma initial appliqué (migration —
  [06-schema-base-donnees.md](06-schema-base-donnees.md)).
- Comptes fournisseurs ouverts : eSMS Africa (compte distinct de MBONPLAN),
  Google Maps Platform (ou Mapbox si ce choix est fait à ce stade),
  Expo/EAS pour les builds mobiles.
- Squelettes des trois applications (Expo passager, Expo chauffeur, admin
  web) qui compilent et se connectent à Supabase — écran vide, pas de
  fonctionnalité.
- **Décision requise de votre part avant cette phase** : confirmer le choix
  Google Maps vs Mapbox (impact coût), et si possible pré-sélectionner un
  fournisseur Mobile Money à évaluer en premier (voir
  [10-paiements.md](10-paiements.md)).

## Phase 1 — Authentification et profils

- Inscription/connexion OTP, passager et chauffeur.
- Écran profil minimal.
- Vérifiable : un compte réel créé de bout en bout, code SMS reçu et
  vérifié (leçon MBONPLAN : tester avec un vrai numéro togolais, pas
  seulement en local).

## Phase 2 — Chauffeur : KYC et validation admin

- Upload documents, formulaire véhicule, file d'attente admin, décision
  approuvé/rejeté avec notification.
- Vérifiable : un dossier complet soumis, validé par un compte admin de
  test, chauffeur débloqué côté app.

## Phase 3 — Abonnement (mode manuel d'abord)

- Achat du Pass Jour en mode paiement manuel/admin (voir
  [10-paiements.md](10-paiements.md)) — permet de livrer la fonctionnalité
  sans attendre le choix définitif d'un fournisseur Mobile Money.
- Affichage statut/temps restant, blocage de la disponibilité sans
  abonnement actif.
- Tâche planifiée d'expiration.

## Phase 4 — Course : commande, matching, suivi (le cœur du produit)

- Carte, sélection destination, estimation de prix (tarification fixe pour
  commencer, pas encore configurable en base).
- Moteur de matching complet ([08-matching.md](08-matching.md)).
- Suivi temps réel bidirectionnel, cycle complet arrivée→démarrage→fin.
- Vérifiable : une course réelle de bout en bout entre un compte passager et
  un compte chauffeur de test, à Lomé, sur réseau mobile réel (pas
  seulement en Wi-Fi/émulateur — leçon directement issue de l'expérience
  MBONPLAN sur l'app Capacitor).

## Phase 5 — Paiement course (déclaratif) + notation + historique

- Confirmation de paiement cash/Mobile Money direct par le chauffeur.
- Notation bidirectionnelle, historique passager et chauffeur, revenus
  chauffeur.

## Phase 6 — Admin : dashboard complet

- Les huit domaines du cadrage (§13 Admin) : utilisateurs, chauffeurs,
  documents, courses (dont carte live), abonnements, paiements,
  statistiques — dans cet ordre de priorité, la carte live et les
  statistiques avancées pouvant suivre une fois le flux de base opérationnel.

## Phase 7 — Sécurité et fiabilité opérationnelle

- SOS, signalement, suspension de compte, détection de doublons — activable
  dès que le flux de base tient, avant tout lancement public réel.
- Audit logs sur toutes les actions sensibles.
- Tarification réellement configurable depuis l'admin (au lieu de la valeur
  fixe de la phase 4).

## Phase 8 — Bascule paiement automatisé

- Intégration réelle du fournisseur Mobile Money retenu (webhook +
  re-vérification API), remplace le mode manuel de la phase 3 sans
  changement de schéma.

## Phase 9 — Lancement Lomé (bêta fermée puis ouverte)

- Recrutement d'un premier groupe de chauffeurs test, itération sur les
  frictions réelles (délai de matching perçu, fiabilité GPS, clarté du prix)
  avant ouverture large.

## Après le MVP (explicitement hors périmètre initial, prévu dans l'architecture)

- Abonnements 7 jours / 30 jours (activation de données, pas de migration).
- Comptes professionnels / flottes de véhicules.
- Publicité, options de visibilité chauffeur.
- Livraison de colis, moto-taxi (nouvelle catégorie de véhicule/service —
  le schéma `rides`/`vehicles` est conçu pour absorber une catégorie
  supplémentaire).
- Tarification dynamique (surge).
- Partage de trajet public (lien externe).
- Extension à d'autres villes du Togo au-delà de Lomé (`zones` déjà prêt).
- Chat texte in-app (le MVP s'appuie sur l'appel téléphonique natif).

## Ce que cette roadmap suppose de votre côté

- Décisions fournisseurs (Maps, Mobile Money) aux jalons indiqués.
- Un ou plusieurs comptes de test réels (numéros togolais) pour chaque
  vérification de bout en bout — aucune étape n'est déclarée « terminée »
  sans un test réel, jamais seulement théorique (règle déjà appliquée sur
  MBONPLAN, reconduite ici).
- Validation du concept sur les 12 livrables de ce dossier avant le
  démarrage du développement (Phase 0) — c'est l'objet de cette première
  livraison.
