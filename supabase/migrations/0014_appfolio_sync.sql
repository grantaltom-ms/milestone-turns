-- Migration 0014: AppFolio sync integration
--
-- 1. Populate properties.appfolio_id with confirmed name-matched mappings
-- 2. Create appfolio_sync_settings table (per-property sync toggle + default assignee)
-- 3. Add appfolio_unit_id to turns for deduplication

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Populate properties.appfolio_id
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.properties SET appfolio_id = '141'  WHERE name = '1255 Kearny St';
UPDATE public.properties SET appfolio_id = '106'  WHERE name = '1413 East John';
UPDATE public.properties SET appfolio_id = '107'  WHERE name = '1415 East John';
UPDATE public.properties SET appfolio_id = '108'  WHERE name = '1620 32nd Ave';
UPDATE public.properties SET appfolio_id = '145'  WHERE name = '1803 F Street';
UPDATE public.properties SET appfolio_id = '142'  WHERE name = '2318 Fairview Ave';
UPDATE public.properties SET appfolio_id = '110'  WHERE name = 'Ansonia';
UPDATE public.properties SET appfolio_id = '111'  WHERE name = 'Ascona';
UPDATE public.properties SET appfolio_id = '218'  WHERE name = 'Astro Plaza';
UPDATE public.properties SET appfolio_id = '143'  WHERE name = 'Beachcomber Apartments';
UPDATE public.properties SET appfolio_id = '112'  WHERE name = 'Bel Vista';
UPDATE public.properties SET appfolio_id = '113'  WHERE name = 'Bon Vista';
UPDATE public.properties SET appfolio_id = '114'  WHERE name = 'Brandon Court';
UPDATE public.properties SET appfolio_id = '115'  WHERE name = 'Bridgewood';
UPDATE public.properties SET appfolio_id = '116'  WHERE name = 'Buccaneer';
UPDATE public.properties SET appfolio_id = '144'  WHERE name = 'California Court Apartments';
UPDATE public.properties SET appfolio_id = '117'  WHERE name = 'Castle';
UPDATE public.properties SET appfolio_id = '118'  WHERE name = 'CC Dolores';
UPDATE public.properties SET appfolio_id = '119'  WHERE name = 'CC Edmunds';
UPDATE public.properties SET appfolio_id = '120'  WHERE name = 'CC Hudson';
UPDATE public.properties SET appfolio_id = '147'  WHERE name = 'Century Manor Apartments';
UPDATE public.properties SET appfolio_id = '121'  WHERE name = 'Colony Surf';
UPDATE public.properties SET appfolio_id = '122'  WHERE name = 'Crosby';
UPDATE public.properties SET appfolio_id = '123'  WHERE name = 'DD Culp';
UPDATE public.properties SET appfolio_id = '660'  WHERE name = 'Delmont Apartments';
UPDATE public.properties SET appfolio_id = '124'  WHERE name = 'Envoy';
UPDATE public.properties SET appfolio_id = '125'  WHERE name = 'Galer Crest';
UPDATE public.properties SET appfolio_id = '126'  WHERE name = 'Heather';
UPDATE public.properties SET appfolio_id = '148'  WHERE name = 'Iron Ridge Apartments';
UPDATE public.properties SET appfolio_id = '127'  WHERE name = 'Isherwood';
UPDATE public.properties SET appfolio_id = '128'  WHERE name = 'Kenton';
UPDATE public.properties SET appfolio_id = '129'  WHERE name = 'Kerry Park';
UPDATE public.properties SET appfolio_id = '1619' WHERE name = 'Legacy Place';
UPDATE public.properties SET appfolio_id = '659'  WHERE name = 'Olympic View Apartments';
UPDATE public.properties SET appfolio_id = '130'  WHERE name = 'Park Place';
UPDATE public.properties SET appfolio_id = '886'  WHERE name = 'Pine Creek Apartments';
UPDATE public.properties SET appfolio_id = '131'  WHERE name = 'Prospect Manor';
UPDATE public.properties SET appfolio_id = '132'  WHERE name = 'Raleigh House';
UPDATE public.properties SET appfolio_id = '133'  WHERE name = 'Redmond View';
UPDATE public.properties SET appfolio_id = '134'  WHERE name = 'Roni Lee';
UPDATE public.properties SET appfolio_id = '1468' WHERE name = 'Stonehaven Apartments';
UPDATE public.properties SET appfolio_id = '661'  WHERE name = 'The Frances';
UPDATE public.properties SET appfolio_id = '135'  WHERE name = 'Top of Fifth';
UPDATE public.properties SET appfolio_id = '1620' WHERE name = 'Town & Country Apartments';
UPDATE public.properties SET appfolio_id = '136'  WHERE name = 'Townvue';
UPDATE public.properties SET appfolio_id = '149'  WHERE name = 'Twin Apartments';
UPDATE public.properties SET appfolio_id = '137'  WHERE name = 'University View';
UPDATE public.properties SET appfolio_id = '138'  WHERE name = 'UW Pacific';
UPDATE public.properties SET appfolio_id = '1231' WHERE name = 'Willow Lake Apartments';
UPDATE public.properties SET appfolio_id = '139'  WHERE name = 'Woodland';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. appfolio_sync_settings: per-property sync toggle + default assignee
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appfolio_sync_settings (
  id               bigserial PRIMARY KEY,
  property_id      bigint NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  sync_enabled     boolean NOT NULL DEFAULT false,
  default_assignee text NOT NULL DEFAULT '??',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

DROP TRIGGER IF EXISTS appfolio_sync_settings_touch ON public.appfolio_sync_settings;
CREATE TRIGGER appfolio_sync_settings_touch
  BEFORE UPDATE ON public.appfolio_sync_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.appfolio_sync_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read appfolio_sync_settings" ON public.appfolio_sync_settings;
CREATE POLICY "admin read appfolio_sync_settings" ON public.appfolio_sync_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "admin write appfolio_sync_settings" ON public.appfolio_sync_settings;
CREATE POLICY "admin write appfolio_sync_settings" ON public.appfolio_sync_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. appfolio_unit_id on turns for deduplication
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.turns ADD COLUMN IF NOT EXISTS appfolio_unit_id bigint;
CREATE INDEX IF NOT EXISTS turns_appfolio_unit_idx
  ON public.turns(appfolio_unit_id)
  WHERE appfolio_unit_id IS NOT NULL;
