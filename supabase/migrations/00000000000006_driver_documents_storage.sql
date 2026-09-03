-- Bucket Storage privé pour les documents KYC chauffeur (pièce d'identité,
-- permis, carte de transport, assurance, carte grise) et la photo du
-- véhicule — jamais d'URL publique, accès uniquement par URL signée à durée
-- limitée (voir docs/11-securite.md §Documents KYC). Absent du projet réel
-- jusqu'ici (aucune trace en migration ni dashboard, voir docs/STATUS.md).
--
-- Convention de chemin obligatoire, à respecter par toute app qui uploade :
-- <driver_id>/<nom_de_fichier> — le premier segment doit être l'UUID auth
-- du chauffeur (`storage.foldername(name))[1]`), c'est ce que les policies
-- ci-dessous vérifient pour restreindre l'accès à ses propres fichiers.

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

create policy driver_documents_storage_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'driver-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.has_admin_role(array['super_admin', 'admin']::public.admin_role[])
  )
);

create policy driver_documents_storage_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy driver_documents_storage_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy driver_documents_storage_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
