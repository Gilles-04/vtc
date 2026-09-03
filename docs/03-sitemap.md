# 03 — Sitemap

Trois applications indépendantes (voir [02-architecture-technique.md](02-architecture-technique.md)).
Les apps mobiles utilisent une navigation par piles (stack), pas des URL —
les chemins ci-dessous sont les noms de route internes, utiles pour le suivi
analytique et les deep links (ex. notification push → écran précis).

## App Passager

```
/onboarding                    (première ouverture, non connecté)
/auth/telephone                 saisie numéro
/auth/otp                       saisie code reçu par SMS
/auth/profil                    nom, langue (première connexion uniquement)

/accueil                        carte + choix 🚗 Voiture / 🏍️ Moto-taxi + "Où allez-vous ?"
/commande/destination           recherche/sélection adresse d'arrivée
/commande/estimation             récap trajet + catégorie + prix estimé (figé dès confirmation) + mode paiement
/commande/recherche              "Recherche d'un chauffeur..." (matching en cours, filtré par catégorie)
/course/suivi                    chauffeur assigné, carte temps réel, contact
/course/en-cours                 course démarrée, suivi position + destination
/course/fin                      récap, paiement, notation

/historique                      liste des courses passées
/historique/:id                  détail d'une course passée (facture incluse une fois générée)

/profil                          infos compte, langue
/profil/moyens-paiement          Mobile Money enregistrés (numéro, opérateur)

/sos                             bouton SOS (accessible depuis toute course active)
/signalement/:course_id          signaler un problème sur une course

/support                         contact assistance
```

## App Chauffeur

```
/onboarding                     première ouverture, non connecté
/auth/telephone
/auth/otp

/inscription/categorie            choix 🚗 Voiture / 🏍️ Moto-taxi — définitif, détermine abonnement/tarif/matching
/inscription/profil              identité, ville de rattachement
/inscription/documents           upload pièce identité, permis, carte transport
/inscription/vehicule             marque, modèle, plaque, année, photo
/inscription/attente-validation   statut "en cours d'examen"
/inscription/refuse               motif de refus + possibilité de re-soumettre

/accueil                         statut abonnement (catégorie affichée) + bascule disponibilité
/abonnement                       plans de sa catégorie, achat, historique
/abonnement/paiement              Mobile Money, confirmation

/course/demande                  nouvelle demande entrante (accepter/refuser, décompte)
/course/navigation-prise-en-charge  itinéraire vers le passager
/course/en-cours                  itinéraire vers la destination, boutons "Démarrer"/"Terminer"
/course/fin                       récap course, confirmation paiement reçu

/revenus                         gains transport du jour/semaine/mois (net des frais de service), historique abonnements — les deux jamais mélangés à l'affichage
/factures                        factures générées, une par course terminée et payée
/statistiques                     nombre de courses, note moyenne, taux d'acceptation

/profil
/support
/sos                              (partagé avec le flux passager côté logique)
```

## Dashboard Admin (web)

```
/                                 vue d'ensemble (KPIs temps réel)
/login

/utilisateurs                     liste + recherche passagers
/utilisateurs/:id                 détail, suspendre/supprimer

/chauffeurs                       liste, filtre par statut
/chauffeurs/:id                   détail, documents, véhicule, historique
/chauffeurs/validations            file d'attente KYC à traiter

/vehicules                        liste, recherche par plaque

/courses                          liste + filtres (statut, période, zone)
/courses/carte-live                suivi temps réel des courses en cours
/courses/:id                       détail complet d'une course

/abonnements                      liste des abonnements, plans (config, par catégorie)
/abonnements/plans                 CRUD des plans (prix, durée, catégorie, actif/inactif)

/paiements                        liste des transactions, filtres statut/fournisseur
/paiements/:id                     détail, action manuelle si besoin

/facturation                      liste des factures générées, filtre passager/chauffeur/période
/facturation/:id                   détail d'une facture (transport, frais de service, total)
/reglements                       créances de frais de service par chauffeur, règlements en attente
/reglements/nouveau                sélection chauffeur + période → création d'un règlement
/reglements/:id                    détail, marquer payé

/tarification                     paramètres du moteur de tarification, par catégorie
/zones                            gestion des zones (villes, quartiers, nuit)

/promotions                       codes promo (préparé, non actif au MVP)

/reclamations                     file des signalements et SOS
/reclamations/:id                  détail, résolution
/fraude                           file de revue anti-fraude (appareils partagés, anomalies GPS)
/fraude/:id                        détail, décision (confirmer/écarter)

/statistiques                     revenus (abonnement et frais de service séparés, par catégorie), courses, croissance chauffeurs/passagers

/parametres                       équipe admin, rôles
```
