
-- Restrict public listing of the photos storage bucket
-- Remove overly broad SELECT policy if it exists, and create a scoped one
DO $$
BEGIN
  -- Drop existing broad policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Photos are publicly accessible'
  ) THEN
    DROP POLICY "Photos are publicly accessible" ON storage.objects;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read photos'
  ) THEN
    DROP POLICY "Public read photos" ON storage.objects;
  END IF;
END $$;

-- Allow public read of individual photo objects (not listing)
CREATE POLICY "Public read individual photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos' AND auth.role() = 'anon');
