# 10 — Logique des paiements

## Deux circuits de paiement bien distincts

C'est la conséquence directe du modèle économique (§1, rappelé en
[01-architecture-fonctionnelle.md](01-architecture-fonctionnelle.md)) et le
point le plus structurant de ce document :

1. **Paiement de l'abonnement chauffeur → plateforme** : c'est le seul flux
   d'argent qui transite réellement par la plateforme. Doit être fiable,
   tracé, confirmé serveur — détail du cycle en
   [09-abonnement.md](09-abonnement.md).
2. **Paiement de la course → passager vers chauffeur, direct** : cash ou
   Mobile Money **du passager vers le chauffeur**, hors plateforme, sans
   commission, sans que la plateforme ne touche les fonds. Le rôle de
   l'application ici est uniquement déclaratif : le chauffeur confirme avoir
   reçu le paiement (bouton en fin de course), ce qui clôt la course, mais
   aucune transaction financière ne passe par un compte plateforme pour ce
   flux au MVP.

Cette séparation évite à la plateforme d'avoir à obtenir un agrément
d'établissement de paiement / de monnaie électronique pour manipuler les
fonds des courses — seule la vente de son propre service (l'abonnement) est
un flux financier direct plateforme↔chauffeur.

## Paiement de l'abonnement — architecture

```
App Chauffeur ─► purchase_subscription(plan_id, provider)
                          │
              payments(status='pending', provider_ref=null)
                          │
              Edge Function : initie la transaction chez le
              fournisseur Mobile Money (redirection USSD/app,
              ou lien de paiement selon l'intégration retenue)
                          │
        ┌─────────────────┴─────────────────┐
   Webhook fournisseur                 Polling de secours
   (paiement confirmé/échoué)          (si webhook non reçu après délai)
        │                                     │
        └─────────────────┬─────────────────┘
                           │
        Re-vérification directe auprès de l'API fournisseur
        (jamais confiance dans le seul contenu du webhook)
                           │
              payments.status = 'success' | 'failed'
                           │
              si succès → driver_subscriptions activé/prolongé
```

Déduplication par `payment_webhook_events.event_key` (unique) — un webhook
livré deux fois (cas fréquent chez la plupart des fournisseurs Mobile Money)
ne doit jamais activer deux fois ou créer un doublon.

## Fournisseur(s) — décision ouverte

**Aucun fournisseur n'est câblé au jour 1**, par choix : MBONPLAN a
directement subi le coût d'un fournisseur qui a cessé de fonctionner au Togo
(CinetPay, retiré le 28/08/2026) après intégration complète. Ici,
l'abstraction (`payments.provider` en enum, logique isolée dans une seule
Edge Function `payment-webhook-momo`) permet de changer de fournisseur sans
toucher au reste du système.

Options à évaluer avec vous avant intégration réelle :

| Option | Nature | Remarque |
|---|---|---|
| **Flooz** (Moov Africa Togo) en direct | API opérateur | Couverture large, intégration technique à documenter |
| **TMoney** (Togocom) en direct | API opérateur | Idem, deuxième opérateur majeur au Togo |
| **Semoa Togo** (agrégateur) | Agrégateur multi-opérateurs | Déjà à l'étude côté MBONPLAN pour le même marché — mutualisation possible du choix |
| **CinetPay** | Agrégateur régional | Écarté côté MBONPLAN en 2026 (ne fonctionnait plus au Togo côté utilisateur) — à ne retenir qu'après vérification que le problème est résolu |

## Mode de secours — paiement manuel/admin

Exactement le principe déjà en place sur MBONPLAN pendant l'absence de
fournisseur actif : un chauffeur peut signaler avoir payé (référence de
transaction Mobile Money saisie manuellement, ex. reçu SMS de l'opérateur),
et un admin confirme manuellement via `admin_manual_payment_confirm` après
vérification. Ce mode permet de **lancer le MVP sans attendre le choix
définitif d'un fournisseur** — la bascule vers un flux automatisé n'impose
aucun changement de schéma, uniquement le branchement réel de l'Edge
Function.

## Historique et reçus

- `payments` conserve l'intégralité des tentatives (y compris échouées) —
  jamais de suppression.
- Un reçu simple est généré (PDF, `jsPDF`) pour chaque abonnement payé avec
  succès, consultable dans `/abonnement` côté chauffeur.
- Remboursement : au MVP, uniquement manuel côté admin
  (`payments.status='refunded'` + note), pas de remboursement automatisé —
  cas rare pour un abonnement de 24 h à 1 500 FCFA, traité au cas par cas.

## Sécurité du circuit de paiement

- Clés API fournisseur **jamais côté client** — uniquement dans les
  variables d'environnement serveur des Edge Functions (cf. règle MBONPLAN :
  secrets jamais commités, jamais dans le bundle mobile).
- Signature de chaque webhook vérifiée avant tout traitement.
- Montant et référence toujours revérifiés auprès de l'API fournisseur avant
  activation — un webhook ne suffit jamais seul.
