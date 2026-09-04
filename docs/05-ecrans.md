# 05 — Liste complète des écrans (MVP)

Un écran = un état d'interface identifiable. Correspond à la sitemap
([03-sitemap.md](03-sitemap.md)) avec le contenu attendu de chacun.

**Le canvas de design (39 planches, voir [`docs/TASKS.md`](TASKS.md)
TASK-002) a été publié avant la révision du modèle économique du
3 septembre 2026** (deux catégories, facturation, écrans de règlement
admin) — il ne reflète pas encore les écrans/contenus ajoutés ci-dessous
(marqués **nouveau**). Une passe de mise à jour du canvas reste à faire,
volontairement pas traitée dans cette révision (voir
[docs/STATUS.md](STATUS.md)).

## App Passager (15 écrans)

| # | Écran | Contenu clé |
|---|---|---|
| 1 | Onboarding | Logo, proposition de valeur en une phrase, bouton Continuer |
| 2 | Saisie téléphone | Champ +228, bouton Envoyer le code |
| 3 | Saisie OTP | 6 champs code, renvoi possible après délai, erreur claire si faux code |
| 4 | Profil initial | Nom, choix langue FR/EN |
| 5 | Accueil / carte | Carte centrée sur position, choix **🚗 Voiture / 🏍️ Moto-taxi** (nouveau, côte à côte, avant toute estimation), champ « Où allez-vous ? », accès historique/profil |
| 6 | Sélection destination | Recherche adresse, résultats, sélection sur carte en repli |
| 7 | Estimation course | Catégorie choisie rappelée, distance/durée/prix (figé dès confirmation), choix paiement, bouton Commander |
| 8 | Recherche chauffeur | Animation d'attente, bouton Annuler |
| 9 | Suivi chauffeur en approche | Carte + position chauffeur, fiche chauffeur/véhicule, appel, ETA |
| 10 | Course en cours | Carte + trajet, ETA destination, bouton SOS visible |
| 11 | Fin de course | Prix final, mode paiement, notation, commentaire |
| 12 | Historique | Liste chronologique, catégorie, statut, prix |
| 13 | Détail course passée | Facture une fois générée (transport + frais de service inclus dans le total, jamais un supplément), trajet, chauffeur, note donnée |
| 14 | Signalement | Catégorie de signalement, description, envoi |
| 15 | Aucun chauffeur disponible | État déjà couvert (écran 8, cas d'erreur), listé ici séparément : course passée en `cancelled_by_system` (renommé depuis `no_drivers_found`), message clair, bouton réessayer |

Écrans transverses : Profil/paramètres, Moyens de paiement, SOS (overlay
disponible depuis 9/10), Support.

## App Chauffeur (19 écrans)

| # | Écran | Contenu clé |
|---|---|---|
| 1-3 | Onboarding, téléphone, OTP | Identiques au passager |
| 4 | Choix catégorie | **Nouveau** — 🚗 Voiture ou 🏍️ Moto-taxi, définitif, avant le profil |
| 5 | Profil chauffeur | Nom, ville de rattachement |
| 6 | Documents KYC | Upload par type (pièce identité, permis, carte transport, assurance) avec statut par document |
| 7 | Véhicule | Marque, modèle, couleur, plaque, année, photo |
| 8 | Attente de validation | Statut, délai indicatif |
| 9 | Dossier refusé | Motif, correction ciblée |
| 10 | Accueil chauffeur | Catégorie affichée, statut abonnement (temps restant), bascule disponibilité (désactivée si pas d'abonnement) |
| 11 | Abonnement — plans | Pass Jour de sa catégorie (1 000 FCFA voiture / 300 FCFA moto-taxi, actif), 7j/30j (affichés « Bientôt disponible ») |
| 12 | Abonnement — paiement | Choix opérateur Mobile Money, confirmation |
| 13 | Historique abonnements | Dates début/fin, statut, montant |
| 14 | Nouvelle demande de course | Décompte, zone de prise en charge, prix estimé, Accepter/Refuser |
| 15 | Navigation vers passager | Carte + itinéraire, bouton Je suis arrivé |
| 16 | Course en cours | Carte + itinéraire vers destination, bouton Terminer |
| 17 | Fin de course | Confirmation de réception du paiement (déclenche le calcul des frais de service et la facture) |
| 18 | Revenus | Gains transport jour/semaine/mois (net des frais de service), historique de courses — jamais mélangé à l'abonnement |
| 19 | Factures | **Nouveau** — liste des factures générées, une par course terminée et payée |

Écrans transverses : Statistiques (courses, note, taux d'acceptation), Profil,
Support, SOS.

## Dashboard Admin (24 écrans)

| # | Écran | Contenu clé |
|---|---|---|
| 1 | Connexion | Email/mot de passe staff |
| 2 | Vue d'ensemble | KPIs par catégorie : courses du jour, chauffeurs actifs, revenu abonnement et frais de service **affichés séparément**, alertes en attente |
| 3 | Liste utilisateurs | Recherche, filtre statut, pagination |
| 4 | Détail utilisateur | Profil, historique courses, actions (suspendre/supprimer) |
| 5 | Liste chauffeurs | Filtre par statut (pending/approved/rejected/suspended) et par catégorie (voiture/moto-taxi) |
| 6 | Détail chauffeur | Catégorie, documents, véhicule, historique, abonnements, statistiques |
| 7 | File de validation KYC | Dossiers en attente, tri par ancienneté |
| 8 | Liste véhicules | Recherche par plaque/chauffeur |
| 9 | Liste courses | Filtres statut/période/zone/catégorie |
| 10 | Carte live des courses | Position temps réel des courses en cours, par catégorie |
| 11 | Détail course | Chronologie complète, catégorie, montants (transport/frais de service/total), parties |
| 12 | Abonnements — liste | Filtre statut, chauffeur, plan, catégorie |
| 13 | Abonnements — plans (config) | CRUD plans, prix, durée, catégorie, actif/inactif |
| 14 | Paiements | Liste transactions, filtre statut/fournisseur, action manuelle |
| 15 | Facturation — liste | **Nouveau** — factures générées, filtre passager/chauffeur/période |
| 16 | Facturation — détail | **Nouveau** — montant transport, frais de service, total, mode de paiement |
| 17 | Règlements — liste | **Nouveau** — créances de frais de service par chauffeur, en attente/réglées |
| 18 | Règlements — nouveau | **Nouveau** — sélection chauffeur + période → génération |
| 19 | Règlements — détail | **Nouveau** — marquer payé, méthode, trace |
| 20 | Tarification | Paramètres moteur de prix par catégorie, historique des versions |
| 21 | Zones | CRUD zones, horaires nuit, majoration |
| 22 | Réclamations & SOS | File priorisée, détail, résolution |
| 23 | Fraude | **Nouveau** — file de revue (appareils partagés, anomalies GPS), détail, décision |
| 24 | Statistiques globales | Revenus (abonnement et frais de service séparés, par catégorie), croissance, rétention chauffeurs |

Total MVP : **~58 écrans/états d'interface** répartis sur les trois
applications (contre ~50 avant la révision du modèle économique du
3 septembre 2026 — voir la note en tête de ce document sur le canvas de
design non encore mis à jour).
