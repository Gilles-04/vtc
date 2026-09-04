-- Vrais tarifs communiqués par le porteur du projet le 4 septembre 2026
-- (aucun chiffre inventé — voir CLAUDE.md/§Règles : les tarifs sont une
-- décision business, jamais fabriquée dans le code).
--
-- Abonnement plateforme (subscription_plans, déjà seedé — Pass Jour
-- voiture 1000 FCFA déjà correct) : correction du Pass Jour moto,
-- seedé à 500 FCFA lors d'une session précédente sans confirmation
-- réelle, corrigé à 300 FCFA (chiffre confirmé).
update public.subscription_plans set price_fcfa = 300 where code = 'pass_jour_moto';

-- Tarification course (pricing_rules, vide jusqu'ici — bloquait
-- entièrement la demande de course et complete_ride) : un tarif par
-- catégorie, sans zone (zone_id null = tarif par défaut plateforme,
-- cohérent avec `estimate_ride_fare`, migration 2, qui préfère un tarif
-- de zone s'il en existe un mais retombe sur celui-ci sinon).
--   - Voiture : 250 FCFA prise en charge + 250 FCFA/km, pas de prix à la
--     minute, jamais moins de 700 FCFA la course.
--   - Moto-taxi : 100 FCFA prise en charge + 70 FCFA/km, pas de prix à la
--     minute, pas de minimum (0 = aucun plancher au-delà du calcul
--     normal, `greatest(fare, 0)` ne change jamais rien).
--   - Majoration de nuit : 10 %, 22h-5h, les deux catégories.
insert into public.pricing_rules (category, zone_id, base_fare_fcfa, price_per_km_fcfa, price_per_min_fcfa, minimum_fare_fcfa, night_multiplier_percent)
values
  ('car', null, 250, 250, 0, 700, 10),
  ('moto', null, 100, 70, 0, 0, 10);

-- Correctif d'architecture découvert en câblant ces tarifs :
-- `estimate_ride_fare` (migration 2) ne calcule `_is_night` que si
-- `_zone_id` est fourni (lecture de `zones.night_start_time`/
-- `night_end_time`) — sinon `_is_night` reste `false` en dur. Or la
-- sélection de zone est optionnelle côté passager (`PassengerHome.tsx`)
-- et la table `zones` est vide sur le projet réel : la majoration de nuit
-- ne se serait donc *jamais* déclenchée en pratique. Ajout d'un repli sur
-- une fenêtre de nuit par défaut (22h-5h, le chiffre communiqué) quand
-- aucune zone n'est fournie ; une zone spécifique garde la priorité si
-- elle est un jour configurée avec ses propres horaires.
create or replace function public.estimate_ride_fare(_distance_km numeric, _duration_min numeric, _category public.driver_category, _zone_id uuid default null)
returns table (pricing_rule_id uuid, fare_fcfa integer, is_night boolean)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _rule record;
  _is_night boolean := false;
  _fare numeric;
begin
  select * into _rule
  from public.pricing_rules
  where category = _category
    and effective_from <= now()
    and (zone_id = _zone_id or zone_id is null)
  order by (zone_id is not null) desc, effective_from desc
  limit 1;

  if _rule is null then
    raise exception 'no_pricing_rule_configured';
  end if;

  if _zone_id is not null then
    select (current_time >= z.night_start_time or current_time < z.night_end_time) into _is_night
    from public.zones z where z.id = _zone_id;
  else
    _is_night := current_time >= time '22:00' or current_time < time '05:00';
  end if;

  _fare := _rule.base_fare_fcfa
           + (_distance_km * _rule.price_per_km_fcfa)
           + (_duration_min * _rule.price_per_min_fcfa);

  if coalesce(_is_night, false) then
    _fare := _fare * (1 + _rule.night_multiplier_percent / 100.0);
  end if;

  _fare := greatest(_fare, _rule.minimum_fare_fcfa);

  return query select _rule.id, round(_fare)::integer, coalesce(_is_night, false);
end;
$$;
