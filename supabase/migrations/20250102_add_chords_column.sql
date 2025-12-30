-- Add chords column to audio_analysis_cache table
-- Stores chord progression data from Modal analysis

ALTER TABLE audio_analysis_cache
ADD COLUMN IF NOT EXISTS chords JSONB;

-- Add comment on the new column
COMMENT ON COLUMN audio_analysis_cache.chords IS 'Array of detected chord changes with timestamps and chord names';
