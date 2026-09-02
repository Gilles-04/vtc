# État du projet — VTC Togo

*Dernière mise à jour : 2 septembre 2026 (cadrage initial + schéma vérifié)*

> Instantané, pas un journal — réécrit à chaque mise à jour significative.

## 1. Où en est-on ?

Projet créé le 2 septembre 2026, séparé de MBONPLAN (aucun rapport entre les
deux produits). **Aucun code applicatif n'existe encore** — seuls les 12
livrables de cadrage (`docs/`) et le schéma de base de données initial sont
faits. Rien n'est déployé, aucun compte fournisseur (Supabase, Google Maps,
eSMS Africa, Mobile Money) n'est encore ouvert pour ce projet.

## 2. Ce qui fonctionne

Les 12 livrables de cadrage sont rédigés (voir sommaire dans
[`../README.md`](../README.md)). Le schéma SQL initial
(`supabase/migrations/00000000000001_schema_initial.sql`) a été **réellement
testé** en local (Postgres 16 + PostGIS installés pour l'occasion, pas
seulement relu) : application propre de bout en bout, RLS vérifiée (un
utilisateur non authentifié ne voit rien, un utilisateur voit sa propre
ligne), trigger de création de profil/rôle à l'inscription fonctionnel,
contrainte d'unicité sur l'abonnement actif validée (une deuxième tentative
est bien rejetée), colonnes sensibles (`drivers.status` notamment) bien
protégées contre une écriture directe côté client.

## 3. Ce qui pose problème / limites connues

- **Aucun projet Supabase réel créé** — le schéma n'a été appliqué qu'à un
  Postgres local jetable pour vérification, jamais à un vrai projet.
- **Aucune application (mobile ou admin) initialisée** — seuls des dossiers
  avec un README expliquant leur rôle futur existent dans `apps/`/`packages/`.
- **Décisions fournisseurs non prises** (bloquantes pour la Phase 0 de la
  roadmap) : Google Maps vs Mapbox, choix d'un prestataire Mobile Money
  (Flooz/TMoney en direct, ou agrégateur type Semoa Togo) — voir §7.

Rien en cours — en attente de la prochaine demande.

## 5. Dernièrement terminé

**2 septembre 2026** — Séparation du projet de MBONPLAN actée avec
l'utilisateur (nouveau dépôt `Gilles-04/vtc`, création manuelle côté GitHub
après échec de la création automatique — l'app GitHub connectée ne peut pas
créer de nouveaux dépôts sur un compte personnel). Rédaction des 12
livrables de cadrage. Écriture et vérification réelle du schéma de base de
données initial.

## 6. Prochaine étape

Décisions fournisseurs (§7) puis Phase 0 de
[`12-roadmap.md`](12-roadmap.md) : création du vrai projet Supabase,
application du schéma, ouverture des comptes eSMS Africa/Maps/Expo,
initialisation réelle des trois applications.

## 7. Décision(s) / action(s) requise(s) de votre part

- **Cartographie** : confirmer Google Maps Platform (recommandé en doc 02,
  facturé à l'usage) ou préférer Mapbox dès le départ.
- **Mobile Money** : indiquer un ordre de préférence parmi Flooz (direct),
  TMoney (direct), Semoa Togo (agrégateur) — voir doc 10 pour le détail. Le
  MVP peut démarrer en mode paiement manuel/admin sans attendre cette
  décision (Phase 3 de la roadmap), mais elle conditionne la Phase 8.
- **Compte Supabase** : à créer (ou fournir l'accès si un compte existe
  déjà) pour ouvrir un projet dédié à ce produit.
- **Comptes développeur mobile** : Expo/EAS (build), Google Play Console et
  Apple Developer si une publication est envisagée — non bloquant avant la
  Phase 9.
