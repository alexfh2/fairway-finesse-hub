-- Public view of players excluding phone (PII)
CREATE OR REPLACE VIEW public.players_public
WITH (security_invoker=on) AS
SELECT
  id, license, name, club, current_handicap, initial_handicap,
  gender, is_senior, photo_url, created_at, updated_at
FROM public.players;

GRANT SELECT ON public.players_public TO anon, authenticated;

-- Drop public SELECT policy on the base table; admins keep ALL access via existing policy
DROP POLICY IF EXISTS "Players are publicly readable" ON public.players;