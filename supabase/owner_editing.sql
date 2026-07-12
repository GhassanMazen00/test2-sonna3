-- ============================================================
-- Sonnaع — Let factory owners edit their own page
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Owners may now edit their name, sector, governorate and all profile data.
-- Two things stay admin-only and are force-preserved on every owner update:
--   * verified            (owners can't verify themselves)
--   * data.featured       (homepage feature is an admin decision)
-- ============================================================

create or replace function public.factories_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    -- can't self-verify / un-verify
    new.verified := old.verified;
    -- preserve the admin-only "featured" flag inside the data blob
    new.data := jsonb_set(
      coalesce(new.data, '{}'::jsonb),
      '{featured}',
      coalesce(old.data -> 'featured', 'false'::jsonb),
      true
    );
    -- name, sector, gov and the rest of data are the owner's to edit
  end if;
  return new;
end $$;

drop trigger if exists factories_guard_trg on public.factories;
create trigger factories_guard_trg before update on public.factories
  for each row execute function public.factories_guard();
