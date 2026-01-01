-- Create audio_analysis_cache table for caching Modal analysis results
-- This significantly reduces API costs and speeds up repeated analysis

CREATE TABLE IF NOT EXISTS audio_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  video_title TEXT,
  duration NUMERIC,
  tempo NUMERIC,
  key TEXT,
  beats JSONB,
  sections JSONB,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on video_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_audio_analysis_cache_video_id
  ON audio_analysis_cache(video_id);

-- Create index on analyzed_at for cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_audio_analysis_cache_analyzed_at
  ON audio_analysis_cache(analyzed_at);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_audio_analysis_cache_updated_at ON audio_analysis_cache;

CREATE TRIGGER update_audio_analysis_cache_updated_at
  BEFORE UPDATE ON audio_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment explaining the table
COMMENT ON TABLE audio_analysis_cache IS
  'Caches audio analysis results from Modal to avoid re-analyzing the same videos';

-- Add comments on columns
COMMENT ON COLUMN audio_analysis_cache.video_id IS 'YouTube video ID (unique identifier)';
COMMENT ON COLUMN audio_analysis_cache.duration IS 'Total duration of the video in seconds';
COMMENT ON COLUMN audio_analysis_cache.tempo IS 'Detected tempo in BPM';
COMMENT ON COLUMN audio_analysis_cache.key IS 'Detected musical key (e.g., "C major")';
COMMENT ON COLUMN audio_analysis_cache.beats IS 'Array of beat timestamps in seconds';
COMMENT ON COLUMN audio_analysis_cache.sections IS 'Array of detected sections with start, end, and type';
COMMENT ON COLUMN audio_analysis_cache.analyzed_at IS 'When the analysis was performed';

-- Optional: Create a function to clean up old cache entries (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_cache_entries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audio_analysis_cache
  WHERE analyzed_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_cache_entries IS
  'Deletes cache entries older than 30 days. Run periodically via cron job.';
