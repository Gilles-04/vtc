# 05 — Liste complète des écrans (MVP)

Un écran = un état d'interface identifiable. Correspond à la sitemap
([03-sitemap.md](03-sitemap.md)) avec le contenu attendu de chacun.

## App Passager (14 écrans)

| # | Écran | Contenu clé |
|---|---|---|
| 1 | Onboarding | Logo, proposition de valeur en une phrase, bouton Continuer |
| 2 | Saisie téléphone | Champ +228, bouton Envoyer le code |
| 3 | Saisie OTP | 6 champs code, renvoi possible après délai, erreur claire si faux code |
| 4 | Profil initial | Nom, choix langue FR/EN |
| 5 | Accueil / carte | Carte centrée sur position, champ « Où allez-vous ? », accès historique/profil |
| 6 | Sélection destination | Recherche adresse, résultats, sélection sur carte en repli |
| 7 | Estimation course | Distance/durée/prix, choix paiement, bouton Commander |
| 8 | Recherche chauffeur | Animation d'attente, bouton Annuler |
| 9 | Suivi chauffeur en approche | Carte + position chauffeur, fiche chauffeur/véhicule, appel, ETA |
| 10 | Course en cours | Carte + trajet, ETA destination, bouton SOS visible |
| 11 | Fin de course | Prix final, mode paiement, notation, commentaire |
| 12 | Historique | Liste chronologique, statut, prix |
| 13 | Détail course passée | Reçu, trajet, chauffeur, note donnée |
| 14 | Signalement | Catégorie, description, envoi |

Écrans transverses : Profil/paramètres, Moyens de paiement, SOS (overlay
disponible depuis 9/10), Support.

## App Chauffeur (17 écrans)

| # | Écran | Contenu clé |
|---|---|---|
| 1-3 | Onboarding, téléphone, OTP | Identiques au passager |
| 4 | Profil chauffeur | Nom, ville de rattachement |
| 5 | Documents KYC | Upload par type (pièce identité, permis, carte transport, assurance) avec statut par document |
| 6 | Véhicule | Marque, modèle, couleur, plaque, année, photo |
| 7 | Attente de validation | Statut, délai indicatif |
| 8 | Dossier refusé | Motif, correction ciblée |
| 9 | Accueil chauffeur | Statut abonnement (temps restant), bascule disponibilité (désactivée si pas d'abonnement) |
| 10 | Abonnement — plans | Pass Jour (actif), 7j/30j (affichés « Bientôt disponible ») |
| 11 | Abonnement — paiement | Choix opérateur Mobile Money, confirmation |
| 12 | Historique abonnements | Dates début/fin, statut, montant |
| 13 | Nouvelle demande de course | Décompte, zone de prise en charge, prix estimé, Accepter/Refuser |
| 14 | Navigation vers passager | Carte + itinéraire, bouton Je suis arrivé |
| 15 | Course en cours | Carte + itinéraire vers destination, bouton Terminer |
| 16 | Fin de course | Montant à percevoir, confirmation |
| 17 | Revenus | Gains jour/semaine/mois, graphique simple, historique de courses |

Écrans transverses : Statistiques (courses, note, taux d'acceptation), Profil,
Support, SOS.

## Dashboard Admin (18 écrans)

| # | Écran | Contenu clé |
|---|---|---|
| 1 | Connexion | Email/mot de passe staff |
| 2 | Vue d'ensemble | KPIs : courses du jour, chauffeurs actifs, revenus abonnements, alertes en attente |
| 3 | Liste utilisateurs | Recherche, filtre statut, pagination |
| 4 | Détail utilisateur | Profil, historique courses, actions (suspendre/supprimer) |
| 5 | Liste chauffeurs | Filtre par statut (pending/approved/rejected/suspended) |
| 6 | Détail chauffeur | Documents, véhicule, historique, abonnements, statistiques |
| 7 | File de validation KYC | Dossiers en attente, tri par ancienneté |
| 8 | Liste véhicules | Recherche par plaque/chauffeur |
| 9 | Liste courses | Filtres statut/période/zone |
| 10 | Carte live des courses | Position temps réel des courses en cours |
| 11 | Détail course | Chronologie complète, montants, parties |
| 12 | Abonnements — liste | Filtre statut, chauffeur, plan |
| 13 | Abonnements — plans (config) | CRUD plans, prix, durée, actif/inactif |
| 14 | Paiements | Liste transactions, filtre statut/fournisseur, action manuelle |
| 15 | Tarification | Paramètres moteur de prix, historique des versions |
| 16 | Zones | CRUD zones, horaires nuit, majoration |
| 17 | Réclamations & SOS | File priorisée, détail, résolution |
| 18 | Statistiques globales | Revenus, croissance, rétention chauffeurs |

Total MVP : **~50 écrans/états d'interface** répartis sur les trois
applications.
