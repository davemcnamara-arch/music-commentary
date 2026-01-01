-- Add Ultimate Guitar chord data to web_metadata_cache
-- Stores real chord progressions from Ultimate Guitar tabs

ALTER TABLE web_metadata_cache
ADD COLUMN IF NOT EXISTS ug_chords JSONB,
ADD COLUMN IF NOT EXISTS ug_sections JSONB,
ADD COLUMN IF NOT EXISTS ug_rating NUMERIC,
ADD COLUMN IF NOT EXISTS ug_votes INTEGER,
ADD COLUMN IF NOT EXISTS ug_url TEXT,
ADD COLUMN IF NOT EXISTS ug_license TEXT;

-- Add comments
COMMENT ON COLUMN web_metadata_cache.ug_chords IS 'Array of chords from Ultimate Guitar tab with positions: [{"name": "C", "position": 0.1, "section": "Verse"}]';
COMMENT ON COLUMN web_metadata_cache.ug_sections IS 'Chord progressions by section from Ultimate Guitar: [{"name": "Verse", "chords": ["C", "Am", "F", "G"]}]';
COMMENT ON COLUMN web_metadata_cache.ug_rating IS 'Ultimate Guitar tab rating (0-5)';
COMMENT ON COLUMN web_metadata_cache.ug_votes IS 'Number of votes for the tab (popularity indicator)';
COMMENT ON COLUMN web_metadata_cache.ug_url IS 'URL to the Ultimate Guitar tab';
COMMENT ON COLUMN web_metadata_cache.ug_license IS 'License/attribution text for Ultimate Guitar content';

-- Create index on ug_votes for finding well-rated tabs
CREATE INDEX IF NOT EXISTS idx_web_metadata_cache_ug_votes
  ON web_metadata_cache(ug_votes DESC)
  WHERE ug_votes IS NOT NULL;

-- Update verified_web_metadata view to include chord data
DROP VIEW IF EXISTS verified_web_metadata;

CREATE OR REPLACE VIEW verified_web_metadata AS
SELECT
  video_id,
  artist,
  title,
  genre,
  genre_tags,
  key,
  tempo,
  duration,
  release_year,
  mood,
  style,
  sources,
  confidence,
  ug_chords,
  ug_sections,
  ug_rating,
  ug_votes,
  ug_url,
  fetched_at
FROM web_metadata_cache
WHERE confidence IN ('high', 'medium')
ORDER BY confidence DESC, ug_votes DESC NULLS LAST, fetched_at DESC;

COMMENT ON VIEW verified_web_metadata IS
  'View showing only high and medium confidence web metadata with Ultimate Guitar chord data for reliable data access';
