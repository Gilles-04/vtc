# 04 — Parcours utilisateur

## Passager — de l'inscription à la première course

1. Ouvre l'app → écran d'accueil non connecté → « Continuer ».
2. Saisit son numéro de téléphone (+228 pré-rempli) → reçoit un code par SMS
   (eSMS Verify) → saisit le code.
3. Code validé → compte créé → écran profil minimal (nom) → accueil.
4. Sur l'accueil, la carte se centre sur sa position (autorisation
   géolocalisation demandée explicitement, avec explication de son usage).
5. Choisit sa catégorie — 🚗 Voiture ou 🏍️ Moto-taxi, affichées côte à côte
   dès l'accueil — **avant** toute estimation de prix (les deux catégories
   ont des tarifs différents, voir
   [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)).
6. Tape « Où allez-vous ? » → recherche d'adresse (autocomplete) ou sélection
   sur la carte → confirme la destination.
7. Écran d'estimation : distance, durée, prix estimé pour la catégorie
   choisie (bien visible, figé dès confirmation), choix du mode de
   paiement (cash par défaut, ou Mobile Money enregistré) → « Commander ».
8. Écran de recherche : la plateforme cherche un chauffeur de la catégorie
   choisie (voir [08-matching.md](08-matching.md)) — le passager voit un
   statut (« Recherche en cours... »), peut annuler à tout moment avant
   acceptation.
9. Un chauffeur accepte → écran de suivi : photo, nom, note, véhicule
   (marque/couleur/plaque) du chauffeur, position en approche sur la carte,
   bouton d'appel téléphonique direct, ETA d'arrivée.
10. Le chauffeur signale son arrivée → notification « Votre chauffeur est
    arrivé ».
11. Le chauffeur démarre la course → écran de suivi pendant le trajet,
    position mise à jour en continu, ETA vers la destination.
12. Le chauffeur termine la course → écran de fin : prix final (identique à
    l'estimation en l'absence de détour, sinon recalculé sur la distance
    réelle), rappel du mode de paiement choisi, bouton de notation
    (1 à 5 étoiles + commentaire optionnel).
13. La course apparaît dans l'historique ; la facture (transport + frais de
    service inclus dans le total payé, jamais un supplément) est
    consultable une fois générée automatiquement.

**Cas d'erreur couverts** : aucun chauffeur disponible après épuisement de la
liste (message clair + proposition de réessayer) ; annulation par le
passager avant/après acceptation (motif optionnel, distinction dans les
statistiques admin) ; annulation par le chauffeur après acceptation (le
passager repasse en recherche automatiquement, sans tout ressaisir) ; perte de
connexion pendant une course (l'état de la course vit côté serveur, l'app
resynchronise à la reconnexion, ne perd jamais la course en cours).

## Chauffeur — de l'inscription à la première course rémunérée

1. Inscription par téléphone/OTP (identique au passager).
2. Choisit sa catégorie — 🚗 Voiture ou 🏍️ Moto-taxi — **définitive** : elle
   détermine son abonnement, sa tarification et son pool de matching pour
   toute la suite (changer de catégorie plus tard n'est pas un simple
   changement de champ, voir
   [01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)).
3. Formulaire profil : nom, ville de rattachement (Lomé au lancement).
4. Upload documents obligatoires : pièce d'identité, permis de conduire,
   carte de transport (si applicable localement), photo du véhicule, carte
   grise/assurance.
5. Formulaire véhicule : marque, modèle, couleur, plaque d'immatriculation,
   année.
6. Soumission → statut `pending_review` → écran d'attente, avec estimation de
   délai et rappel que le compte reste inactif tant que non validé.
7. **Décision admin** (voir parcours admin) :
   - Refusé → écran avec motif précis, bouton pour corriger et re-soumettre
     uniquement les documents en cause (pas tout le dossier).
   - Approuvé → notification push + écran d'accueil chauffeur débloqué.
8. Écran d'accueil : bandeau « Aucun abonnement actif » tant qu'aucun pass
   n'est acheté — bouton disponibilité grisé/inactif jusqu'à l'achat.
9. Achète le Pass Jour de sa catégorie (**1 000 FCFA** voiture,
   **500 FCFA** moto-taxi) → paiement Mobile Money → confirmation →
   abonnement actif affiché avec compte à rebours (temps restant).
10. Active sa disponibilité → apparaît dans le pool de matching **de sa
    catégorie uniquement**.
11. Reçoit une demande de course : écran plein écran avec décompte (le
    chauffeur doit répondre avant expiration, sinon la demande passe au
    suivant), infos minimales (zone de prise en charge, distance
    approximative, prix estimé) → Accepter/Refuser.
12. Accepte → navigation guidée vers le point de prise en charge → bouton
    « Je suis arrivé » → bouton « Démarrer la course » (activé seulement à
    proximité du point de prise en charge, tolérance GPS) → navigation vers
    la destination → bouton « Terminer la course ».
13. Écran de fin : montant à percevoir, rappel du mode de paiement choisi par
    le passager, confirmation de réception (pour le cash notamment) — c'est
    ce geste qui déclenche le calcul des frais de service (2,5 %) et la
    facture automatique.
14. Le montant transport (net des frais de service dus, jamais mélangé à
    l'abonnement) s'ajoute à ses revenus du jour, visibles sur `/revenus` ;
    les frais de service dus s'accumulent séparément jusqu'au prochain
    règlement (voir [10-paiements.md](10-paiements.md)).

**Cas d'erreur couverts** : abonnement qui expire pendant que le chauffeur est
disponible mais sans course en cours (bascule automatique en indisponible,
notification d'expiration) ; abonnement qui expire pendant une course en
cours (la course en cours va jusqu'à son terme normalement — le chauffeur
n'est simplement pas repris dans le matching suivant tant qu'il ne renouvelle
pas) ; document rejeté après une première validation (ex. permis expiré
détecté a posteriori) → statut repasse en révision, disponibilité coupée
automatiquement jusqu'à régularisation.

## Admin — validation d'un chauffeur

1. Ouvre `/chauffeurs/validations` → liste des dossiers `pending_review`,
   triée par ancienneté de soumission.
2. Ouvre un dossier → visualise chaque document (URL signée, expire après
   consultation), les infos véhicule, l'identité déclarée.
3. Pour chaque document : Approuver / Rejeter (motif obligatoire si rejet).
4. Une fois tous les documents traités : décision globale du dossier
   (Approuver / Rejeter) → notification automatique au chauffeur.
5. Action tracée (`audit_logs`) : qui a validé/rejeté, quand, quel motif.

## Admin — suivi d'une réclamation ou d'un SOS

1. Un SOS déclenché en course apparaît en tête de `/reclamations` avec un
   badge prioritaire, position en temps réel, informations course/passager/
   chauffeur immédiatement visibles (pas de navigation supplémentaire
   nécessaire).
2. Un signalement standard (post-course) apparaît avec catégorie, description,
   parties concernées.
3. L'admin peut : contacter les parties (téléphone affiché), suspendre un
   compte le temps de l'investigation, clore avec résolution documentée.
4. Toute suspension est tracée et notifiée à l'utilisateur concerné.

## Admin — configuration de la tarification

1. `/tarification` : modifie tarif de base, prix/km, prix/min, minimum de
   course, majoration nuit, par zone **et par catégorie** (voiture et
   moto-taxi ont chacune leur propre grille, jamais partagée).
2. Chaque modification crée une nouvelle version datée (`effective_from`) —
   les courses déjà estimées/en cours gardent le tarif figé au moment de la
   commande, aucune course en cours n'est recalculée rétroactivement.

## Admin — règlement des frais de service

1. `/reglements` : liste des chauffeurs avec des courses payées non encore
   rattachées à un règlement (créance de 2,5 % accumulée depuis le dernier
   règlement).
2. `/reglements/nouveau` : choisit un chauffeur et une période → génère le
   règlement (`admin_create_settlement`) — regroupe toutes les courses
   éligibles de la période, les rattache, calcule le total dû.
3. Une fois le virement/versement effectué hors plateforme, marque le
   règlement payé (`admin_mark_settlement_paid`) avec la méthode utilisée —
   trace conservée, jamais un simple statut sans historique.
4. Le revenu d'abonnement et les frais de service restent deux colonnes
   séparées partout dans ce parcours, jamais additionnés en un seul total.
