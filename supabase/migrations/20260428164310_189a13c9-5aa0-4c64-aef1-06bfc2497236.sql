ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_type_check;
ALTER TABLE public.photos ADD CONSTRAINT photos_type_check
  CHECK (type = ANY (ARRAY['winners'::text, 'gallery'::text, 'news'::text]));