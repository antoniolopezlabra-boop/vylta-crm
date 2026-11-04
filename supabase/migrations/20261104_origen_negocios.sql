-- ═══════════════════════════════════════════════════════════════════
-- Origen de cada negocio (columna "Origen" en /admin/tenants)
-- 2026-11-04
--
-- 1) FIX: signup_attribution nunca guardó filas. El CRM hace upsert
--    (INSERT ... ON CONFLICT DO UPDATE) y Postgres exige que la fila nueva
--    pase también la política SELECT; solo existía SELECT para admins →
--    "new row violates row-level security policy" para todo usuario normal.
--    Se agrega SELECT propio.
-- 2) Backfill: registros web pasados se enlazan a su sesión del embudo por
--    hora (evento register_success ≤30 s después de crear la cuenta).
-- 3) RPC admin_get_tenant_origins(): origen legible por negocio.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Política SELECT propia
drop policy if exists attr_select_own on public.signup_attribution;
create policy attr_select_own on public.signup_attribution
  for select to authenticated using (auth.uid() = user_id);

-- 2) Backfill por hora (solo coincidencias claras)
insert into public.signup_attribution (user_id, session_id, giro, utm_source, utm_medium, utm_campaign, created_at)
select distinct on (u.id) u.id, fe.session_id, fe.giro, fe.utm_source, fe.utm_medium, fe.utm_campaign, u.created_at
from auth.users u
join public.business_profiles bp on bp.user_id = u.id
join public.funnel_events fe
  on fe.event_name = 'register_success'
 and fe.created_at between u.created_at - interval '5 seconds' and u.created_at + interval '30 seconds'
where not exists (select 1 from public.signup_attribution sa where sa.user_id = u.id)
order by u.id, abs(extract(epoch from fe.created_at - u.created_at))
on conflict (user_id) do nothing;

-- 3) Etiqueta legible a partir de utm / referrer
create or replace function public.vylta_origen_label(p_src text, p_med text, p_ref text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(p_src,'')) in ('meta','facebook','fb','instagram','ig')
         and lower(coalesce(p_med,'')) in ('paid','cpc','ads','pauta') then 'Anuncio Meta'
    when lower(coalesce(p_src,'')) in ('meta','facebook','fb') then 'Facebook'
    when lower(coalesce(p_src,'')) in ('instagram','ig') then 'Instagram'
    when lower(coalesce(p_src,'')) = 'google' and lower(coalesce(p_med,'')) in ('cpc','paid','ads') then 'Google Ads'
    when lower(coalesce(p_src,'')) = 'google-play' then 'Play Store (búsqueda)'
    when lower(coalesce(p_src,'')) = 'google' then 'Google'
    when lower(coalesce(p_src,'')) like '%whatsapp%' then 'WhatsApp'
    when lower(coalesce(p_src,'')) = 'experiencia' then 'Experiencia vylta.lat'
    when p_src is not null and p_src <> '' then initcap(p_src)
    when p_ref ~* 'facebook\.com|fb\.com|fbclid' then 'Facebook'
    when p_ref ~* 'instagram\.com' then 'Instagram'
    when p_ref ~* 'google\.' then 'Google'
    when p_ref ~* 'whatsapp|wa\.me' then 'WhatsApp'
    when p_ref ~* 'tiktok' then 'TikTok'
    else 'vylta.lat (directo)'
  end
$$;

create or replace function public.admin_get_tenant_origins()
returns table (user_id uuid, origen text, detalle text, via text, metodo text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from vylta_admins va where va.user_id = auth.uid() and va.is_active) then
    raise exception 'forbidden';
  end if;

  return query
  with base as (
    select bp.user_id as uid, bp.referido_por, u.created_at as u_created,
           (select s.user_agent from auth.sessions s where s.user_id = bp.user_id
             order by s.created_at limit 1) as ua
    from business_profiles bp
    join auth.users u on u.id = bp.user_id
  ),
  sa as (
    select b.uid, a.session_id, a.utm_source, a.utm_medium, a.utm_campaign, a.giro
    from base b join signup_attribution a on a.user_id = b.uid
  ),
  -- primer toque de la sesión del embudo (el que trae utm/referrer real)
  touch as (
    select distinct on (sa.uid) sa.uid, fe.utm_source, fe.utm_medium, fe.utm_campaign, fe.referrer, fe.path
    from sa join funnel_events fe on fe.session_id = sa.session_id
    where sa.session_id is not null and sa.session_id not like 'play:%'
    order by sa.uid, (fe.utm_source is null), fe.created_at
  )
  select b.uid,
    case
      when e.id is not null then 'Embajador'
      when sa.uid is not null then
        vylta_origen_label(coalesce(t.utm_source, sa.utm_source), coalesce(t.utm_medium, sa.utm_medium), t.referrer)
      when b.ua ~* 'FB_IAB|FBAN|FBAV' then 'Facebook'
      when b.ua ~* 'Instagram' then 'Instagram'
      else 'Sin rastro'
    end,
    case
      when e.id is not null then e.nombre
      when sa.uid is not null then nullif(concat_ws(' · ',
             coalesce(t.utm_campaign, sa.utm_campaign),
             case when coalesce(sa.giro,'') <> '' and coalesce(t.utm_campaign, sa.utm_campaign,'') not ilike '%'||sa.giro||'%' then sa.giro end), '')
      when b.ua ~* 'okhttp|CFNetwork' then 'Descargó la app directo'
      else null
    end,
    case
      when b.ua ~* 'okhttp' then 'App Android'
      when b.ua ~* 'CFNetwork|Darwin' then 'App iPhone'
      when b.ua ~* 'Android' then 'Web (celular)'
      when b.ua ~* 'iPhone|iPad' then 'Web (iPhone)'
      when b.ua is not null and b.ua !~* 'Vercel' then 'Web (computadora)'
      else null
    end,
    case
      when e.id is not null then 'embajador'
      when sa.session_id like 'play:%' or (sa.uid is not null and sa.session_id is null) then 'play'
      when sa.uid is not null then 'enlace'
      when b.ua ~* 'FB_IAB|FBAN|FBAV|Instagram' then 'navegador'
      else 'ninguno'
    end
  from base b
  left join embajadores e on e.id = b.referido_por
  left join sa on sa.uid = b.uid
  left join touch t on t.uid = b.uid;
end $$;

revoke all on function public.admin_get_tenant_origins() from public, anon;
grant execute on function public.admin_get_tenant_origins() to authenticated;
