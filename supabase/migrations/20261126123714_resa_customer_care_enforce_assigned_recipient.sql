create or replace function private.enforce_admin_only_customer_care_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  sender_role public.school_role;
  recipient_role public.school_role;
  assigned_admin uuid;
begin
  if new.conversation_type <> 'admin_support' then
    return new;
  end if;

  if (select auth.uid()) is null
     or new.created_by is distinct from (select auth.uid())
     or new.participant_one is distinct from (select auth.uid())
     or new.participant_one = new.participant_two then
    raise exception 'Customer Care conversations must be opened by the signed-in school member';
  end if;

  select membership.role into sender_role
  from public.school_memberships membership
  where membership.school_id = new.school_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'::public.membership_status
  limit 1;

  select membership.role into recipient_role
  from public.school_memberships membership
  where membership.school_id = new.school_id
    and membership.user_id = new.participant_two
    and membership.status = 'active'::public.membership_status
  limit 1;

  if sender_role is null then
    raise exception 'An active school membership is required to contact Customer Care';
  end if;

  if recipient_role is distinct from 'admin'::public.school_role then
    raise exception 'Customer Care conversations can only be addressed to an active school administrator';
  end if;

  assigned_admin := private.resa_resolve_customer_care_admin(new.school_id, new.customer_care_duty);
  if assigned_admin is null then
    raise exception 'No active administrator is assigned to this Customer Care duty';
  end if;

  -- Route legacy clients that still submit a manually selected administrator
  -- to the server-authorised duty owner without exposing the routing table.
  new.participant_two := assigned_admin;
  return new;
end;
$function$;
