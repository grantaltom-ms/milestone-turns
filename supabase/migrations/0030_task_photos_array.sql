-- Upgrade task_notes to support multiple photos per note.
-- Replaces the single photo_url text column with a photo_urls text[] array.

ALTER TABLE public.task_notes
  ADD COLUMN photo_urls text[] NOT NULL DEFAULT '{}';

-- Migrate any existing single-photo notes into the new array column.
UPDATE public.task_notes
  SET photo_urls = ARRAY[photo_url]
  WHERE photo_url IS NOT NULL;

ALTER TABLE public.task_notes DROP COLUMN photo_url;

-- Update the content-or-photo constraint to use the array.
ALTER TABLE public.task_notes
  DROP CONSTRAINT IF EXISTS task_notes_has_content_or_photo;

ALTER TABLE public.task_notes
  ADD CONSTRAINT task_notes_has_content_or_photos
  CHECK (content IS NOT NULL OR array_length(photo_urls, 1) > 0);
