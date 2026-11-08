-- Staff are eligible for appointment letters, never student admission letters.
-- Preserve existing permission grants by reclassifying the legacy staff-only
-- admission_letter permission as appointment_letter before tightening the check.
alter table public.staff_document_permissions
  drop constraint if exists staff_document_permissions_document_type_check;

update public.staff_document_permissions
set document_type = 'appointment_letter',
    updated_at = now()
where document_type = 'admission_letter';

alter table public.staff_document_permissions
  add constraint staff_document_permissions_document_type_check
  check (document_type in ('id_card', 'appointment_letter'));

comment on table public.staff_document_permissions is
'RESA staff print permissions for staff ID cards and appointment letters. Student admission letters are not staff documents.';
