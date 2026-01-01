-- Add chord_progressions column to audio_analysis_cache table
-- Stores chord progression data by section from Modal analysis

ALTER TABLE audio_analysis_cache
ADD COLUMN IF NOT EXISTS chord_progressions JSONB;

-- Add comment on the new column
COMMENT ON COLUMN audio_analysis_cache.chord_progressions IS 'Array of chord progressions by section (e.g., [{"section": "Verse 1", "progression": "I - IV - V - I"}])';
