-- Create web_metadata_cache table for caching web-sourced music data
-- This includes data from MusicBrainz, TheAudioDB, and other verified sources
-- Reduces API calls and improves accuracy with verified metadata

CREATE TABLE IF NOT EXISTS web_metadata_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,

  -- Source tracking
  sources TEXT[],  -- Array of sources: ['MusicBrainz', 'TheAudioDB', etc.]
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low', 'none')),

  -- Basic metadata
  artist TEXT,
  title TEXT,
  duration NUMERIC,  -- Duration in seconds
  release_year INTEGER,

  -- Musical attributes
  genre TEXT,
  genre_tags TEXT[],  -- Multiple genre tags
  key TEXT,
  tempo NUMERIC,
  mood TEXT,
  style TEXT,

  -- Structure hints (boolean flags, not exact timestamps)
  has_chorus BOOLEAN,
  has_bridge BOOLEAN,
  has_intro BOOLEAN,
  instrumental_sections BOOLEAN,

  -- Raw data for debugging and future analysis
  raw_musicbrainz_data JSONB,
  raw_theaudiodb_data JSONB,

  -- Verification status
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on video_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_web_metadata_cache_video_id
  ON web_metadata_cache(video_id);

-- Create index on confidence for filtering high-quality data
CREATE INDEX IF NOT EXISTS idx_web_metadata_cache_confidence
  ON web_metadata_cache(confidence);

-- Create index on fetched_at for cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_web_metadata_cache_fetched_at
  ON web_metadata_cache(fetched_at);

-- Create index on artist for analytics
CREATE INDEX IF NOT EXISTS idx_web_metadata_cache_artist
  ON web_metadata_cache(artist);

-- Add updated_at trigger (reuse existing function)
CREATE TRIGGER update_web_metadata_cache_updated_at
  BEFORE UPDATE ON web_metadata_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment explaining the table
COMMENT ON TABLE web_metadata_cache IS
  'Caches verified music metadata from web sources (MusicBrainz, TheAudioDB, etc.) to improve accuracy and reduce API calls';

-- Add comments on columns
COMMENT ON COLUMN web_metadata_cache.video_id IS 'YouTube video ID (unique identifier)';
COMMENT ON COLUMN web_metadata_cache.sources IS 'Array of data sources used (e.g., [''MusicBrainz'', ''TheAudioDB''])';
COMMENT ON COLUMN web_metadata_cache.confidence IS 'Confidence level: high (multiple sources), medium (one source), low (uncertain match), none (no data)';
COMMENT ON COLUMN web_metadata_cache.genre IS 'Primary genre from web sources';
COMMENT ON COLUMN web_metadata_cache.genre_tags IS 'Additional genre tags for multi-genre classification';
COMMENT ON COLUMN web_metadata_cache.key IS 'Musical key from web sources (may be more accurate than audio analysis for studio recordings)';
COMMENT ON COLUMN web_metadata_cache.tempo IS 'Tempo in BPM from web sources';
COMMENT ON COLUMN web_metadata_cache.has_chorus IS 'Indicates if song structure includes chorus sections';
COMMENT ON COLUMN web_metadata_cache.raw_musicbrainz_data IS 'Raw JSON response from MusicBrainz API for debugging';
COMMENT ON COLUMN web_metadata_cache.raw_theaudiodb_data IS 'Raw JSON response from TheAudioDB API for debugging';
COMMENT ON COLUMN web_metadata_cache.verified IS 'Manual verification flag for high-value entries';
COMMENT ON COLUMN web_metadata_cache.fetched_at IS 'When the web metadata was fetched';

-- Add cleanup function for old web metadata (older than 60 days)
CREATE OR REPLACE FUNCTION cleanup_old_web_metadata()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM web_metadata_cache
  WHERE fetched_at < NOW() - INTERVAL '60 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_web_metadata IS
  'Deletes web metadata cache entries older than 60 days. Run periodically via cron job.';

-- Add view for high-confidence metadata only
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
  fetched_at
FROM web_metadata_cache
WHERE confidence IN ('high', 'medium')
ORDER BY confidence DESC, fetched_at DESC;

COMMENT ON VIEW verified_web_metadata IS
  'View showing only high and medium confidence web metadata for reliable data access';
