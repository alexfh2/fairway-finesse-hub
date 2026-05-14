DROP POLICY IF EXISTS "Results are publicly readable" ON public.results;

CREATE POLICY "Published round results are publicly readable"
ON public.results
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.rounds
    WHERE rounds.id = results.round_id
      AND rounds.status = 'published'
  )
);