-- App-level helper functions.

-- Lets a coach record a read-type event (for example a data export) in the audit log.
-- audit_log itself stays read-only for every API role.
create or replace function public.log_coach_event(p_table text, p_record uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_coach() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_action not in ('EXPORT', 'VIEW_FILE') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  insert into public.audit_log (table_name, record_id, action, actor_id, data)
  values (p_table, p_record, p_action, auth.uid(), null);
end $$;

revoke all on function public.log_coach_event(text, uuid, text) from public, anon;
grant execute on function public.log_coach_event(text, uuid, text) to authenticated;

-- Coach names and WhatsApp numbers for the client's "contact" section.
-- Clients cannot read coach profiles directly; this exposes only name and phone.
create or replace function public.coach_contacts()
returns table (full_name text, phone text) language sql stable security definer set search_path = '' as $$
  select p.full_name, p.phone from public.profiles p
  where p.role = 'coach' and auth.uid() is not null
  order by p.full_name;
$$;
revoke all on function public.coach_contacts() from public, anon;
grant execute on function public.coach_contacts() to authenticated;
