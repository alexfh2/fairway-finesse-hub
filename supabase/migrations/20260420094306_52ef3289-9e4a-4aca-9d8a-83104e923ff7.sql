-- Fix tone constraint to match values used by UI
ALTER TABLE public.news_drafts DROP CONSTRAINT IF EXISTS news_drafts_tone_check;
ALTER TABLE public.news_drafts ADD CONSTRAINT news_drafts_tone_check
  CHECK (tone = ANY (ARRAY['press'::text, 'whatsapp'::text, 'instagram'::text, 'journalistic'::text, 'friendly'::text]));

-- Add phone column to players for communications database
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS phone text;