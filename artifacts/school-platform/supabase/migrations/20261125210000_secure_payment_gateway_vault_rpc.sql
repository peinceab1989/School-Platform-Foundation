create or replace function public.resa_store_payment_gateway_secret(p_school_id uuid,p_provider text,p_environment text,p_secret_kind text,p_secret_value text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_new_id uuid; v_name text;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Trusted payment backend required' using errcode='42501'; end if;
 if p_school_id is null or p_provider not in ('paystack','monnify','flutterwave') or p_environment not in ('test','live') or p_secret_kind not in ('api_secret_key','webhook_signing_secret') or nullif(trim(coalesce(p_secret_value,'')),'') is null then raise exception 'Invalid payment credential request'; end if;
 if not exists(select 1 from public.schools where id=p_school_id) then raise exception 'Unknown school'; end if;
 v_name := 'resa_'||replace(p_school_id::text,'-','')||'_'||p_provider||'_'||p_environment||'_'||p_secret_kind;
 select vault_secret_id into v_id from public.school_payment_gateway_secret_refs where school_id=p_school_id and provider=p_provider and environment=p_environment and secret_kind=p_secret_kind for update;
 if v_id is null then v_new_id := vault.create_secret(p_secret_value,v_name,'RESA proprietor-managed payment credential; write-only from the portal.',null);
 else v_new_id := vault.update_secret(v_id,p_secret_value,v_name,'RESA proprietor-managed payment credential; write-only from the portal.',null); end if;
 insert into public.school_payment_gateway_secret_refs(school_id,provider,environment,secret_kind,vault_secret_id,updated_at) values(p_school_id,p_provider,p_environment,p_secret_kind,v_new_id,now())
 on conflict(school_id,provider,environment,secret_kind) do update set vault_secret_id=excluded.vault_secret_id,updated_at=now();
 return jsonb_build_object('success',true,'configured',true);
end $$;

create or replace function public.resa_get_payment_gateway_secret(p_school_id uuid,p_provider text,p_environment text,p_secret_kind text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_secret text;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'Trusted payment backend required' using errcode='42501'; end if;
 if p_school_id is null or p_provider not in ('paystack','monnify','flutterwave') or p_environment not in ('test','live') or p_secret_kind not in ('api_secret_key','webhook_signing_secret') then raise exception 'Invalid payment credential request'; end if;
 select d.decrypted_secret into v_secret from public.school_payment_gateway_secret_refs r join vault.decrypted_secrets d on d.id=r.vault_secret_id
 where r.school_id=p_school_id and r.provider=p_provider and r.environment=p_environment and r.secret_kind=p_secret_kind limit 1;
 return v_secret;
end $$;

revoke all on function public.resa_store_payment_gateway_secret(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.resa_get_payment_gateway_secret(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.resa_store_payment_gateway_secret(uuid,text,text,text,text) to service_role;
grant execute on function public.resa_get_payment_gateway_secret(uuid,text,text,text) to service_role;
