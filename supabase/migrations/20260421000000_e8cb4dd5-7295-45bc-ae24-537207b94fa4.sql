create or replace view public.players_public as
select
  id,
  license,
  name,
  club,
  current_handicap,
  initial_handicap,
  gender,
  is_senior,
  photo_url,
  created_at,
  updated_at
from public.players;

alter view public.players_public set (security_invoker = false);