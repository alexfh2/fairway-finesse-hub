DROP POLICY IF EXISTS "Published rounds are publicly readable" ON public.rounds;
CREATE POLICY "Rounds are publicly readable" ON public.rounds FOR SELECT TO public USING (true);