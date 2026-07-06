-- Migration 0015: add photo_url to task_notes + create task-photos storage bucket

-- 1. Add photo_url column (nullable — a note can be text, photo, or both)
ALTER TABLE public.task_notes
  ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Make content nullable so photo-only notes are allowed
ALTER TABLE public.task_notes
  ALTER COLUMN content DROP NOT NULL;

-- 3. Drop the old non-empty-string check and replace with a looser one
ALTER TABLE public.task_notes
  DROP CONSTRAINT IF EXISTS task_notes_content_check;

ALTER TABLE public.task_notes
  ADD CONSTRAINT task_notes_content_check
  CHECK (content IS NULL OR length(trim(content)) > 0);

-- 4. Require at least one of content or photo_url
ALTER TABLE public.task_notes
  ADD CONSTRAINT task_notes_has_content_or_photo
  CHECK (content IS NOT NULL OR photo_url IS NOT NULL);

-- 5. Create the task-photos storage bucket (public reads, auth writes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  true,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS: authenticated users can upload
CREATE POLICY "auth users upload task photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-photos');

-- 7. Storage RLS: public can view (bucket is public, but policy required)
CREATE POLICY "public read task photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'task-photos');

-- 8. Authors can delete their own uploads
CREATE POLICY "auth users delete own task photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-photos' AND owner = auth.uid());
