# Audit 8/12 — Hardening et protection maximale d'un VPS Ubuntu

*Réalisé le 6 septembre 2026.*

---

## Verdict immédiat : NON APPLICABLE à ce projet dans son état actuel

**CONFIRMÉ, pas supposé** — ce projet n'a **aucun VPS**. Preuves
concrètes, pas une déduction :

1. **Aucun fichier `Dockerfile`, `docker-compose.yml` ni configuration
   serveur** dans tout le dépôt (recherche exhaustive, Audit 1 §2).
2. **Le commentaire de migration qui documente ce choix explicitement**
   (`supabase/migrations/00000000000017_interim_cron_offer_sweep.sql`) :
   *« aucun VPS choisi pour ce projet à ce jour (le VPS existant sert un
   autre projet du porteur du projet, une décision de déploiement qui
   n'est pas la mienne à prendre) »*.
3. **L'architecture réelle** (Audit 1 §1, Audit 4 §1) : backend
   entièrement sur Supabase Cloud (managé), frontend en cours de
   déploiement sur Vercel (managé) — **aucun serveur Linux à administrer
   pour ce projet**.

Le VPS mentionné dans le code appartient à un **autre projet** du même
porteur de projet (Gilles) — l'auditer serait hors périmètre et hors
autorisation pour cette session, qui porte exclusivement sur VTC Togo.

---

## Ce que je ne fais donc pas

Conformément à la règle « ne rien inventer » qui encadre les 12 audits
de ce pipeline, je ne produis pas :
- d'inventaire de comptes/services/ports/firewall (aucun serveur) ;
- de checklist de durcissement SSH/AppArmor/sysctl (rien à durcir) ;
- de verdict 🔴/🟠/🟡/🟢 (l'échelle du prompt suppose un serveur réel à
  noter).

Produire une telle checklist « au cas où » reviendrait à halluciner un
serveur qui n'existe pas pour ce projet — exactement ce que la règle 0
de ce prompt (« ne jamais inventer ») interdit.

---

## Ce qui redeviendrait pertinent, et quand

Si le projet évolue vers un composant auto-hébergé, deux cas concrets
sont déjà identifiés ailleurs dans ce dépôt et **redonneraient un sens
réel à cet audit** :

1. **`services/matching-worker`** (Audit 4 §4.1) — le vrai remplaçant
   prévu du balayage `pg_cron` interimaire. Écrit, testé en local,
   jamais déployé faute de serveur. Le jour où un VPS lui est dédié,
   cet audit devient directement applicable : utilisateur système
   dédié (pas root), firewall, SSH, mises à jour automatiques,
   supervision `systemd` (déjà prévue dans le README du worker).
2. **Un domaine personnalisé** (Audit 1 §14) — actuellement absent ;
   s'il s'accompagne un jour d'un reverse proxy auto-hébergé (plutôt
   que de rester derrière Vercel/Supabase), le hardening réseau/TLS de
   ce prompt redevient pertinent.

## Ce que je n'ai pas pu vérifier

Rien à vérifier ici par nature (pas de serveur) — la seule chose non
vérifiable serait l'état du VPS *appartenant à l'autre projet* du
porteur de projet, explicitement hors périmètre de cette session.
