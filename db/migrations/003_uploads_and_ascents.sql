-- Add new processing status values for the vision pipeline confirmation flow
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation';
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'complete';

-- Upload context needed for problem creation at confirm time
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES gyms(id);
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS colour TEXT;
-- Temporary hold vector storage (JSONB auto-parsed by pg-node; copied to problems at confirm time)
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS hold_vector JSONB;

-- Optional ascent fields for Phase 4
ALTER TABLE ascents ADD COLUMN IF NOT EXISTS notes TEXT CHECK (char_length(notes) <= 280);
ALTER TABLE ascents ADD COLUMN IF NOT EXISTS video_url TEXT;
